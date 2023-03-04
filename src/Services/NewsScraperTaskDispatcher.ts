import { inject, injectable } from 'inversify';

import { CONTAINER_TYPES } from '../DI/ContainerTypes';
import { LifecycleStatusEnum } from '../Types/LifecycleStatusEnum';
import { NewsMessageBrokerQueuesDataType, NewsScraperMessageBrokerQueuesEnum } from '../Types/NewsMessageBrokerQueues';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';
import { ProcessingStatusEnum } from '../Types/ProcessingStatusEnum';
import { LOKI_PINO_BATCH_INTERVAL_SECONDS } from '../Utils/Environment';
import { sleep } from '../Utils/Helpers';
import { HTTPServerService } from './HTTPServerService';
import { Logger } from './Logger';
import { NewsScraperDatabase } from './NewsScraperDatabase';
import { NewsScraperManager } from './NewsScraperManager';
import { NewsScraperMessageBroker } from './NewsScraperMessageBroker';
import { NewsScraperScrapeRunManager } from './NewsScraperScrapeRunManager';
import { PrometheusService } from './PrometheusService';

@injectable()
export class NewsScraperTaskDispatcher {
  private _httpServerPort?: number;

  private _newsScrapers: NewsScraperInterface[] = [];
  private _scrapeInterval: number = 30000;
  private _messageQueuesMonitoringInterval: number = 5000;
  private _scrapeRecentArticlesExpirationTime: number = 30000; // After how long do we want to expire this message?

  private _dispatchRecentArticlesScrapeIntervalTimer?: ReturnType<typeof setInterval>;
  private _messageQueuesMonitoringIntervalTimer?: ReturnType<typeof setInterval>;

  constructor(
    @inject(CONTAINER_TYPES.Logger) private _logger: Logger,
    @inject(CONTAINER_TYPES.NewsScraperManager) private _newsScraperManager: NewsScraperManager,
    @inject(CONTAINER_TYPES.NewsScraperMessageBroker) private _newsScraperMessageBroker: NewsScraperMessageBroker,
    @inject(CONTAINER_TYPES.NewsScraperDatabase) private _newsScraperDatabase: NewsScraperDatabase,
    @inject(CONTAINER_TYPES.NewsScraperScrapeRunManager)
    private _newsScraperScrapeRunManager: NewsScraperScrapeRunManager,
    @inject(CONTAINER_TYPES.HTTPServerService) private _httpServerService: HTTPServerService,
    @inject(CONTAINER_TYPES.PrometheusService) private _prometheusService: PrometheusService
  ) {}

  async start(httpServerPort?: number) {
    this._httpServerPort = httpServerPort;

    this._logger.info(`========== Starting the task dispatcher ... ==========`);

    this._registerTerminate();

    await this._purgeQueues();

    await this._sendStatusUpdate(LifecycleStatusEnum.STARTING);

    await this._registerMetrics();

    this._startRecentArticlesScrape();
    this._startRecentArticlesStatusUpdateQueueConsumption();
    this._startMessageQueuesMonitoring();

    await this._sendStatusUpdate(LifecycleStatusEnum.STARTED);

    await new Promise(() => {
      // Together forever and never apart ...
    });
  }

  async terminate(errorMessage?: string) {
    if (errorMessage) {
      this._logger.error(`Terminating news scraper task dispatcher with error: ${errorMessage}`);
    } else {
      this._logger.info(`Terminating news scraper task dispatcher`);
    }

    clearInterval(this._dispatchRecentArticlesScrapeIntervalTimer);
    clearInterval(this._messageQueuesMonitoringIntervalTimer);

    await this._sendStatusUpdate(
      errorMessage ? LifecycleStatusEnum.ERRORED : LifecycleStatusEnum.CLOSING,
      errorMessage
    );

    await this._httpServerService.terminate();
    await this._newsScraperDatabase.terminate();

    await this._sendStatusUpdate(LifecycleStatusEnum.CLOSED);

    await this._newsScraperMessageBroker.terminate();

    // Make sure we give out logger enough time to send the last batch of logs
    await sleep(LOKI_PINO_BATCH_INTERVAL_SECONDS * 1000 * 1.2 /* a bit of buffer accounting for network latency */);

    process.exit(errorMessage ? 1 : 0);
  }

  /**
   * Technically this method is private, but we use them in our tests, so do NOT set them to private!
   */
  async _getSortedScrapers() {
    const scrapers: NewsScraperInterface[] = [];

    const lastScrapeRuns = await this._newsScraperScrapeRunManager.getLastRunsByType(
      NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_QUEUE
    );

    const scrapeRunsscraperKeys = lastScrapeRuns.map((scrapeRun) => {
      return scrapeRun.arguments?.newsSite;
    });

    const newsScrapers = await this._getNewsScrapers();
    const newsScrapersMap = new Map<string, NewsScraperInterface>(
      newsScrapers.map((newsScraper) => {
        return [newsScraper.key, newsScraper];
      })
    );

    if (newsScrapers.length > 0) {
      for (const newsScraper of newsScrapers) {
        if (scrapeRunsscraperKeys.includes(newsScraper.key)) {
          continue;
        }

        scrapers.push(newsScraper);
      }
    }

    for (const lastScrapeRun of lastScrapeRuns) {
      if (lastScrapeRun.status === ProcessingStatusEnum.PROCESSING) {
        continue;
      }

      const newsSiteKey = typeof lastScrapeRun.arguments?.newsSite === 'string' ? lastScrapeRun.arguments.newsSite : '';
      const newsScraper = newsScrapersMap.get(newsSiteKey);
      if (!newsScraper) {
        continue;
      }

      scrapers.push(newsScraper);
    }

    return scrapers;
  }

  async _getNewsScrapers() {
    if (this._newsScrapers.length === 0) {
      this._newsScrapers = await this._newsScraperManager.getAll();
    }

    return this._newsScrapers;
  }

  private _startRecentArticlesScrape() {
    this._dispatchRecentArticlesScrape();

    this._dispatchRecentArticlesScrapeIntervalTimer = setInterval(() => {
      this._dispatchRecentArticlesScrape();
    }, this._scrapeInterval);
  }

  private _startRecentArticlesStatusUpdateQueueConsumption() {
    this._newsScraperMessageBroker.consumeFromQueue(
      NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_STATUS_UPDATE_QUEUE,
      async (data, acknowledgeMessageCallback) => {
        const scrapeRun = data.scrapeRunId ? await this._newsScraperScrapeRunManager.getById(data.scrapeRunId) : null;
        if (scrapeRun) {
          scrapeRun.status = data.status;

          if (data.status === ProcessingStatusEnum.PROCESSING) {
            scrapeRun.startedAt = new Date();
          } else if (data.status === ProcessingStatusEnum.PROCESSED) {
            scrapeRun.completedAt = new Date();
          } else if (data.status === ProcessingStatusEnum.FAILED) {
            scrapeRun.failedAt = new Date();
            scrapeRun.failedErrorMessage = data.errorMessage;
          }

          await this._newsScraperScrapeRunManager.save(scrapeRun);
        }

        acknowledgeMessageCallback();
      }
    );
  }

  private _startMessageQueuesMonitoring() {
    this._messageQueuesMonitoringIntervalTimer = setInterval(async () => {
      const messagesCountMap = await this._newsScraperMessageBroker.getMessageCountInAllQueues();

      this._logger.info(`Messages count map: ${JSON.stringify(messagesCountMap)}`);
    }, this._messageQueuesMonitoringInterval);
  }

  private _registerTerminate() {
    process.on('SIGTERM', async () => {
      await this.terminate();
    });

    process.on('uncaughtException', async (err) => {
      await this.terminate(`UncaughtException: ${err.message}`);
    });
  }

  private async _registerMetrics() {
    this._prometheusService.addDefaultMetrics({ prefix: `news_scraper_task_dispatcher_` });

    if (this._httpServerPort) {
      await this._httpServerService.start(this._httpServerPort, () => {
        this._prometheusService.addMetricsEndpointToExpressApp(this._httpServerService.getExpressApp());
      });
    }
  }

  private async _purgeQueues() {
    for (const queue of [
      NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_TASK_DISPATCHER_STATUS_UPDATE_QUEUE,
      NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_STATUS_UPDATE_QUEUE,
    ]) {
      await this._newsScraperMessageBroker.purgeQueue(queue);
    }
  }

  private async _dispatchRecentArticlesScrape() {
    this._logger.info(`Dispatch news article events for scrapers ...`);

    const scrapers = await this._getSortedScrapers();
    if (scrapers.length === 0) {
      this._logger.info(`Scrapers not found. Skipping ...`);

      return;
    }

    const queue = NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_QUEUE;

    for (const scraper of scrapers) {
      this._logger.debug(`Dispatching events for ${scraper.key} ...`);

      let args: NewsMessageBrokerQueuesDataType[typeof queue] = {
        newsSite: scraper.key,
      };

      const scrapeRun = await this._newsScraperScrapeRunManager.create({
        type: queue,
        status: ProcessingStatusEnum.PENDING,
        arguments: args,
      });
      await this._newsScraperScrapeRunManager.save(scrapeRun);

      args = {
        ...args,
        scrapeRunId: scrapeRun.id,
      };

      await this._newsScraperMessageBroker.sendToQueue(
        queue,
        args,
        { expiration: this._scrapeRecentArticlesExpirationTime, persistent: true },
        { durable: true }
      );
    }
  }

  private async _sendStatusUpdate(status: LifecycleStatusEnum, errorMessage?: string) {
    return this._newsScraperMessageBroker.sendToQueue(
      NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_TASK_DISPATCHER_STATUS_UPDATE_QUEUE,
      { status, errorMessage, httpServerPort: this._httpServerPort }
    );
  }
}
