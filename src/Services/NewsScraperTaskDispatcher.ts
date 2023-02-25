import { createHash } from 'crypto';
import { inject, injectable } from 'inversify';
import { Repository } from 'typeorm';

import { TYPES } from '../DI/ContainerTypes';
import { ScrapeRun } from '../Entitites/ScrapeRun';
import { LifecycleStatusEnum } from '../Types/LifecycleStatusEnum';
import { NewsMessageBrokerQueuesDataType, NewsScraperMessageBrokerQueuesEnum } from '../Types/NewsMessageBrokerQueues';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';
import { NewsScraperStatusEntry } from '../Types/NewsScraperStatusEntry';
import { ProcessingStatusEnum } from '../Types/ProcessingStatusEnum';
import { LOKI_PINO_BATCH_INTERVAL_SECONDS } from '../Utils/Environment';
import { sleep } from '../Utils/Helpers';
import { HTTPServerService } from './HTTPServerService';
import { Logger } from './Logger';
import { NewsScraperDatabase } from './NewsScraperDatabase';
import { NewsScraperManager } from './NewsScraperManager';
import { NewsScraperMessageBroker } from './NewsScraperMessageBroker';
import { PrometheusService } from './PrometheusService';

@injectable()
export class NewsScraperTaskDispatcher {
  private _httpServerPort?: number;

  private _scrapers: NewsScraperInterface[] = [];
  private _scrapeInterval: number = 30000;
  private _messageQueuesMonitoringInterval: number = 5000;
  private _scrapeRecentArticlesExpirationTime: number = 30000; // After how long do we want to expire this message?
  private _scraperStatusMap: Map<string, NewsScraperStatusEntry> = new Map();

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

    await this._prepare();

    await this._purgeQueues();

    await this._sendDispatcherStatusUpdate(LifecycleStatusEnum.STARTING);

    await this._registerMetrics();

    await this.resetScraperStatusMap();

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
  async resetScraperStatusMap() {
    this._scrapers = await this._newsScraperManager.getAll();

    for (const scraper of this._scrapers) {
      this._scraperStatusMap.set(scraper.key, {
        status: ProcessingStatusEnum.PENDING,
        lastUpdate: null,
        lastStarted: null,
        lastProcessed: null,
        lastFailed: null,
        lastFailedErrorMessage: null,
      });
    }
  }

  getSortedScrapers() {
    const scrapers: NewsScraperInterface[] = [];
    const scrapersAppendAtEnd: NewsScraperInterface[] = [];

    for (const scraper of this._scrapers) {
      const scraperStatusData = this._scraperStatusMap.get(scraper.key);
      if (!scraperStatusData) {
        continue;
      }

      if (
        scraperStatusData.lastUpdate !== null &&
        (scraperStatusData.status === ProcessingStatusEnum.PENDING ||
          scraperStatusData.status === ProcessingStatusEnum.PROCESSING)
      ) {
        continue;
      }

      if (scraperStatusData.status === ProcessingStatusEnum.PROCESSED) {
        scrapersAppendAtEnd.push(scraper);

        continue;
      }

      scrapers.push(scraper);
    }

    if (scrapersAppendAtEnd.length > 0) {
      for (const scraperAppendAtEnd of scrapersAppendAtEnd) {
        scrapers.push(scraperAppendAtEnd);
      }
    }

    scrapers.sort((a, b) => {
      const scraperAStatusData = this._scraperStatusMap.get(a.key);
      const scraperBStatusData = this._scraperStatusMap.get(b.key);

      const timeA =
        scraperAStatusData?.lastProcessed?.getTime() ??
        scraperAStatusData?.lastFailed?.getTime() ??
        scraperAStatusData?.lastStarted?.getTime() ??
        0;
      const timeB =
        scraperBStatusData?.lastProcessed?.getTime() ??
        scraperBStatusData?.lastFailed?.getTime() ??
        scraperBStatusData?.lastStarted?.getTime() ??
        0;

      return timeA - timeB;
    });

    return scrapers;
  }

  setScraperStatusMap(key: string, value: NewsScraperStatusEntry) {
    this._scraperStatusMap.set(key, value);

    return this;
  }

  private _startRecentArticlesScraping() {
    this._dispatchRecentArticlesScrape();

    this._dispatchRecentArticlesScrapeIntervalTimer = setInterval(() => {
      this._dispatchRecentArticlesScrape();
    }, this._scrapeInterval);

    this._newsScraperMessageBroker.consumeFromQueue(
      NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_STATUS_UPDATE_QUEUE,
      async (data, acknowledgeMessageCallback) => {
        const scraperStatus = this._scraperStatusMap.get(data.newsSite);
        if (!scraperStatus) {
          acknowledgeMessageCallback();

          return;
        }

        const now = new Date();

        scraperStatus.status = data.status;
        scraperStatus.lastUpdate = now;

        if (data.status === ProcessingStatusEnum.PROCESSING) {
          scraperStatus.lastStarted = now;
        } else if (data.status === ProcessingStatusEnum.PROCESSED) {
          scraperStatus.lastProcessed = now;
        } else if (data.status === ProcessingStatusEnum.FAILED) {
          scraperStatus.lastFailed = now;
          scraperStatus.lastFailedErrorMessage = data.errorMessage ?? null;
        }

        if (data.scrapeRunId) {
          const scrapeRun = await this._scrapeRunRepository.findOneBy({
            id: data.scrapeRunId,
          });
          if (scrapeRun) {
            // TODO
          }
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

  private async _prepare() {
    const dataSource = await this._newsScraperDatabase.getDataSource();

    this._scrapeRunRepository = dataSource.getRepository(ScrapeRun);
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

    const scrapers = this.getSortedScrapers();
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
      const hash = this._getHashForNewsSiteAndQueue(args.newsSite, queue);

      const scrapeRun = this._scrapeRunRepository.create({
        type: queue,
        status: LifecycleStatusEnum.PENDING,
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

  private _getHashForNewsSiteAndQueue(newsSite: string, queue: NewsScraperMessageBrokerQueuesEnum) {
    return createHash('sha256')
      .update(
        JSON.stringify({
          queue,
          newsSite,
        }),
        'utf8'
      )
      .digest('hex');
  }
}
