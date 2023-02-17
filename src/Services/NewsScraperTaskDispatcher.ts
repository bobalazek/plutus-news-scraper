import { inject, injectable } from 'inversify';

import { TYPES } from '../DI/ContainerTypes';
import { LifecycleStatusEnum } from '../Types/LifecycleStatusEnum';
import { NewsScraperMessageBrokerQueuesEnum } from '../Types/NewsMessageBrokerQueues';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';
import { ProcessingStatusEnum } from '../Types/ProcessingStatusEnum';
import { logger } from './Logger';
import { NewsScraperManager } from './NewsScraperManager';
import { NewsScraperMessageBroker } from './NewsScraperMessageBroker';
import { PrometheusMetricsServer } from './PrometheusMetricsServer';

export interface ScraperStatusEntry {
  status: ProcessingStatusEnum;
  lastUpdate: Date | null;
  lastStarted: Date | null;
  lastProcessed: Date | null;
  lastFailed: Date | null;
  lastFailedErrorMessage: string | null;
}

@injectable()
export class NewsScraperTaskDispatcher {
  private _prometheusMetricsServerPort?: number;

  private _scrapers: NewsScraperInterface[] = [];
  private _scrapeInterval: number = 30000;
  private _messagesCountMonitoringInterval: number = 5000;
  private _scrapeRecentArticlesExpirationTime: number = 30000; // After how long do we want to expire this message?

  private _scraperStatusMap: Map<string, ScraperStatusEntry> = new Map();

  constructor(
    @inject(TYPES.NewsScraperManager) private _newsScraperManager: NewsScraperManager,
    @inject(TYPES.NewsScraperMessageBroker) private _newsScraperMessageBroker: NewsScraperMessageBroker,
    @inject(TYPES.PrometheusMetricsServer) private _prometheusMetricsServer: PrometheusMetricsServer
  ) {}

  async start(prometheusMetricsServerPort?: number) {
    this._prometheusMetricsServerPort = prometheusMetricsServerPort;

    logger.info(`========== Starting the task dispatcher ... ==========`);

    await this._newsScraperMessageBroker.sendToQueue(
      NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_TASK_DISPATCHER_STATUS_UPDATE_QUEUE,
      { status: LifecycleStatusEnum.STARTING, prometheusMetricsServerPort }
    );

    if (prometheusMetricsServerPort) {
      await this._prometheusMetricsServer.start(prometheusMetricsServerPort, `news_scraper_task_dispatcher_`);
    }

    await this.setupScrapers();

    this._startRecentArticlesScraping();
    this._startMessageQueuesMonitoring();

    await this._newsScraperMessageBroker.sendToQueue(
      NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_TASK_DISPATCHER_STATUS_UPDATE_QUEUE,
      { status: LifecycleStatusEnum.STARTED, prometheusMetricsServerPort }
    );

    await new Promise(() => {
      // Together forever and never apart ...
    });
  }

  async terminate(errorMessage?: string) {
    await this._newsScraperMessageBroker.sendToQueue(
      NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_TASK_DISPATCHER_STATUS_UPDATE_QUEUE,
      {
        status: errorMessage ? LifecycleStatusEnum.ERRORED : LifecycleStatusEnum.CLOSED,
        prometheusMetricsServerPort: this._prometheusMetricsServerPort,
        errorMessage,
      }
    );
  }

  /* Technically all of the methods below should be private, but we use them in our tests, so ... */
  async setupScrapers() {
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

  getOrderedScrapers() {
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

  setScraperStatusMap(key: string, value: ScraperStatusEntry) {
    this._scraperStatusMap.set(key, value);

    return this;
  }

  private _startRecentArticlesScraping() {
    this._dispatchRecentArticlesScrape();

    setInterval(() => {
      this._dispatchRecentArticlesScrape();
    }, this._scrapeInterval);

    this._newsScraperMessageBroker.consume(
      NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_STATUS_UPDATE_QUEUE,
      (data, acknowledgeMessageCallback) => {
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

        acknowledgeMessageCallback();
      }
    );
  }

  private _startMessageQueuesMonitoring() {
    setInterval(async () => {
      const messagesCountMap = await this._newsScraperMessageBroker.getMessageCountInAllQueues();

      logger.info(`Messages count map: ${JSON.stringify(messagesCountMap)}`);
    }, this._messagesCountMonitoringInterval);
  }

  private async _dispatchRecentArticlesScrape() {
    logger.info(`Dispatch news article events for scrapers ...`);

    const scrapers = this.getOrderedScrapers();

    for (const scraper of scrapers) {
      logger.debug(`Dispatching events for ${scraper.key} ...`);

      await this._newsScraperMessageBroker.sendToQueue(
        NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_QUEUE,
        {
          newsSite: scraper.key,
        },
        { expiration: this._scrapeRecentArticlesExpirationTime, persistent: true },
        { durable: true }
      );
    }
  }
}
