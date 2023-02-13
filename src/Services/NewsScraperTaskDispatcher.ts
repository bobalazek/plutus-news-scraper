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

@injectable()
export class NewsScraperTaskDispatcher {
  private _prometheusMetricsServerPort?: number;

  private _scrapeInterval: number = 30000;
  private _messagesCountMonitoringInterval: number = 5000;
  private _scrapeRecentArticlesExpirationTime: number = 30000; // After how long do we want to expire this message?

  private _scraperStatusMap: Record<
    string,
    {
      status: ProcessingStatusEnum;
      lastStarted: Date | null;
      lastProcessed: Date | null;
      lastFailed: Date | null;
    }
  >;

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

    const scrapers = await this._setupScrapers();

    this._startRecentArticlesScraping(scrapers);
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

  async _setupScrapers() {
    const scrapers = await this._newsScraperManager.getAll();

    for (const scraper of scrapers) {
      this._scraperStatusMap[scraper.key] = {
        status: ProcessingStatusEnum.PENDING,
        lastStarted: null,
        lastProcessed: null,
        lastFailed: null,
      };
    }

    return scrapers;
  }

  private _startRecentArticlesScraping(scrapers: NewsScraperInterface[]) {
    this._dispatchRecentArticlesScrape(scrapers);

    setInterval(async () => {
      await this._dispatchRecentArticlesScrape(scrapers);
    }, this._scrapeInterval);

    // TODO: listen to the started, completed and failed queues to see which queue was successfully processed
    // so we can use that to prepare a map of newsSites that need to be scraped before any other
  }

  private _startMessageQueuesMonitoring() {
    setInterval(async () => {
      const messagesCountMap = await this._newsScraperMessageBroker.getMessageCountInAllQueues();

      logger.info(`Messages count map: ${JSON.stringify(messagesCountMap)}`);
    }, this._messagesCountMonitoringInterval);

    this._newsScraperMessageBroker.consume(
      NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_STATUS_UPDATE_QUEUE,
      (data) => {
        if (typeof this._scraperStatusMap[data.newsSite] === 'undefined') {
          return;
        }

        if (data.status === ProcessingStatusEnum.PROCESSING) {
          this._scraperStatusMap[data.newsSite].lastStarted = new Date();
        } else if (data.status === ProcessingStatusEnum.PROCESSED) {
          this._scraperStatusMap[data.newsSite].lastProcessed = new Date();
        } else if (data.status === ProcessingStatusEnum.FAILED) {
          this._scraperStatusMap[data.newsSite].lastFailed = new Date();
        }
      }
    );
  }

  private async _dispatchRecentArticlesScrape(scrapers: NewsScraperInterface[]) {
    logger.info(`Dispatch news article events for scrapers ...`);

    // TODO: order those we need to schedule first, depending on the this._scraperStatusMap

    for (const scraper of scrapers) {
      logger.debug(`Dispatching events for ${scraper.key} ...`);

      await this._newsScraperMessageBroker.sendToRecentArticlesScrapeQueue(
        {
          newsSite: scraper.key,
        },
        this._scrapeRecentArticlesExpirationTime
      );
    }
  }
}
