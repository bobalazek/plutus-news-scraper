import { inject, injectable } from 'inversify';
import { Repository } from 'typeorm';

import { TYPES } from '../DI/ContainerTypes';
import { ScrapeRun } from '../Entitites/ScrapeRun';
import { LifecycleStatusEnum } from '../Types/LifecycleStatusEnum';
import { NewsMessageBrokerQueuesDataType, NewsScraperMessageBrokerQueuesEnum } from '../Types/NewsMessageBrokerQueues';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';
import { ProcessingStatusEnum } from '../Types/ProcessingStatusEnum';
import { LOKI_PINO_BATCH_INTERVAL_SECONDS } from '../Utils/Environment';
import { getHashForNewsSiteAndQueue, sleep } from '../Utils/Helpers';
import { HTTPServerService } from './HTTPServerService';
import { Logger } from './Logger';
import { NewsScraperDatabase } from './NewsScraperDatabase';
import { NewsScraperManager } from './NewsScraperManager';
import { NewsScraperMessageBroker } from './NewsScraperMessageBroker';
import { PrometheusService } from './PrometheusService';

@injectable()
export class NewsScraperTaskDispatcher {
  private _httpServerPort?: number;

  private _newsScrapers: NewsScraperInterface[] = [];
  private _scrapeInterval: number = 30000;
  private _messageQueuesMonitoringInterval: number = 5000;
  private _scrapeRecentArticlesExpirationTime: number = 30000; // After how long do we want to expire this message?

  private _scrapeRunRepository!: Repository<ScrapeRun>;
  private _dispatchRecentArticlesScrapeIntervalTimer?: ReturnType<typeof setInterval>;
  private _messageQueuesMonitoringIntervalTimer?: ReturnType<typeof setInterval>;

  constructor(
    @inject(TYPES.Logger) private _logger: Logger,
    @inject(TYPES.NewsScraperManager) private _newsScraperManager: NewsScraperManager,
    @inject(TYPES.NewsScraperMessageBroker) private _newsScraperMessageBroker: NewsScraperMessageBroker,
    @inject(TYPES.NewsScraperDatabase) private _newsScraperDatabase: NewsScraperDatabase,
    @inject(TYPES.HTTPServerService) private _httpServerService: HTTPServerService,
    @inject(TYPES.PrometheusService) private _prometheusService: PrometheusService
  ) {}

  async start(httpServerPort?: number) {
    this._httpServerPort = httpServerPort;

    this._logger.info(`========== Starting the task dispatcher ... ==========`);

    this._registerTerminate();

    await this.prepare();

    await this._purgeQueues();

    await this._sendDispatcherStatusUpdate(LifecycleStatusEnum.STARTING);

    await this._registerMetrics();

    this._startRecentArticlesScraping();
    this._startMessageQueuesMonitoring();

    await this._sendDispatcherStatusUpdate(LifecycleStatusEnum.STARTED);

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

    await this._newsScraperMessageBroker.sendToQueue(
      NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_TASK_DISPATCHER_STATUS_UPDATE_QUEUE,
      {
        status: errorMessage ? LifecycleStatusEnum.ERRORED : LifecycleStatusEnum.CLOSING,
        httpServerPort: this._httpServerPort,
        errorMessage,
      }
    );

    await this._newsScraperMessageBroker.terminate();
    await this._httpServerService.terminate();
    await this._newsScraperDatabase.terminate();

    // Make sure we give out logger enough time to send the last batch of logs
    await sleep(LOKI_PINO_BATCH_INTERVAL_SECONDS * 1000 * 1.2 /* a bit of buffer accounting for network latency */);

    process.exit(errorMessage ? 1 : 0);
  }

  /* Technically all of the methods below should be private, but we use them in our tests, so ... */
  async prepare() {
    const dataSource = await this._newsScraperDatabase.getDataSource();

    this._scrapeRunRepository = dataSource.getRepository(ScrapeRun);
    this._newsScrapers = await this._newsScraperManager.getAll();
  }

  async getSortedScrapers() {
    const scrapers: NewsScraperInterface[] = [];

    const lastScrapeRuns = await this._scrapeRunRepository
      .createQueryBuilder('scrapeRun')
      .select('scrapeRun.status')
      .addSelect('scrapeRun.arguments')
      .addSelect('MAX(scrapeRun.createdAt)')
      .distinct(true)
      .where('scrapeRun.type = :type')
      .setParameters({
        type: NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_QUEUE,
      })
      .orderBy('scrapeRun.updatedAt', 'ASC')
      .groupBy('scrapeRun.hash') // Hash will include the queue and newsSite
      .getMany();

    const scrapeRunsscraperKeys = lastScrapeRuns.map((scrapeRun) => {
      return scrapeRun.arguments?.newsSite;
    });

    const newsScrapersMap = new Map<string, NewsScraperInterface>(
      this._newsScrapers.map((newsScraper) => {
        return [newsScraper.key, newsScraper];
      })
    );

    if (this._newsScrapers.length) {
      for (const newsScraper of this._newsScrapers) {
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

  private _startRecentArticlesScraping() {
    this._dispatchRecentArticlesScrape();

    this._dispatchRecentArticlesScrapeIntervalTimer = setInterval(() => {
      this._dispatchRecentArticlesScrape();
    }, this._scrapeInterval);

    this._newsScraperMessageBroker.consumeFromQueue(
      NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_STATUS_UPDATE_QUEUE,
      async (data, acknowledgeMessageCallback) => {
        const scrapeRun = data.scrapeRunId
          ? await this._scrapeRunRepository.findOneBy({
              id: data.scrapeRunId,
            })
          : null;
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

          await this._scrapeRunRepository.save(scrapeRun);
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

  private async _sendDispatcherStatusUpdate(status: LifecycleStatusEnum) {
    return this._newsScraperMessageBroker.sendToQueue(
      NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_TASK_DISPATCHER_STATUS_UPDATE_QUEUE,
      { status, httpServerPort: this._httpServerPort }
    );
  }

  private async _dispatchRecentArticlesScrape() {
    this._logger.info(`Dispatch news article events for scrapers ...`);

    const scrapers = await this.getSortedScrapers();
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
      const hash = getHashForNewsSiteAndQueue(args.newsSite, queue);

      const scrapeRun = this._scrapeRunRepository.create({
        type: queue,
        status: ProcessingStatusEnum.PENDING,
        arguments: args,
        hash,
      });
      await this._scrapeRunRepository.save(scrapeRun);

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
}
