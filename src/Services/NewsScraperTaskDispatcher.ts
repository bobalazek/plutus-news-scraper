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
    // TODO: optimise the whole function

    const scrapers: NewsScraperInterface[] = [];
    const scrapersAppendAtEnd: NewsScraperInterface[] = [];

    const scraperStatusMap = new Map<string, NewsScraperStatusEntry>(
      this._newsScrapers.map((newsScraper) => {
        return [
          newsScraper.key,
          {
            status: ProcessingStatusEnum.PENDING,
            lastUpdatedAt: null,
            lastStartedAt: null,
            lastCompletedAt: null,
            lastFailedAt: null,
            lastFailedErrorMessage: null,
          },
        ];
      })
    );

    const lastScrapeRuns = await this._scrapeRunRepository
      .createQueryBuilder('scrapeRun')
      .where('scrapeRun.type = :type')
      .setParameters({
        type: NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_QUEUE,
      })
      .orderBy('scrapeRun.updatedAt', 'DESC')
      .groupBy('scrapeRun.hash') // Hash will include the queue and newsSite
      .getMany();

    console.log(await this._scrapeRunRepository.find());
    for (const lastScrapeRun of lastScrapeRuns) {
      const newsSiteKey = lastScrapeRun.arguments?.newsSite === 'string' ? lastScrapeRun.arguments.newsSite : '';
      if (!scraperStatusMap.has(newsSiteKey)) {
        continue;
      }

      scraperStatusMap.set(newsSiteKey, {
        status: lastScrapeRun.status,
        lastUpdatedAt: lastScrapeRun.updatedAt ?? null,
        lastStartedAt: lastScrapeRun.startedAt ?? null,
        lastCompletedAt: lastScrapeRun.completedAt ?? null,
        lastFailedAt: lastScrapeRun.failedAt ?? null,
        lastFailedErrorMessage: lastScrapeRun.failedErrorMessage ?? null,
      });
    }

    for (const scraper of this._newsScrapers) {
      const scraperStatusData = scraperStatusMap.get(scraper.key);
      if (!scraperStatusData) {
        continue;
      }

      if (
        scraperStatusData.lastUpdatedAt !== null &&
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
      const scraperAStatusData = scraperStatusMap.get(a.key);
      const scraperBStatusData = scraperStatusMap.get(b.key);

      const timeA =
        scraperAStatusData?.lastCompletedAt?.getTime() ??
        scraperAStatusData?.lastFailedAt?.getTime() ??
        scraperAStatusData?.lastStartedAt?.getTime() ??
        0;
      const timeB =
        scraperBStatusData?.lastCompletedAt?.getTime() ??
        scraperBStatusData?.lastFailedAt?.getTime() ??
        scraperBStatusData?.lastStartedAt?.getTime() ??
        0;

      return timeA - timeB;
    });

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
      const hash = this._getHashForNewsSiteAndQueue(args.newsSite, queue);

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
