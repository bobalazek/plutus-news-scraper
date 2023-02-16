import { inject, injectable } from 'inversify';

import { TYPES } from '../DI/ContainerTypes';
import { LifecycleStatusEnum } from '../Types/LifecycleStatusEnum';
import { NewsScraperMessageBrokerQueuesEnum } from '../Types/NewsMessageBrokerQueues';
import { ProcessingStatusEnum } from '../Types/ProcessingStatusEnum';
import { logger } from './Logger';
import { NewsScraperManager } from './NewsScraperManager';
import { NewsScraperMessageBroker } from './NewsScraperMessageBroker';
import { PrometheusMetricsServer } from './PrometheusMetricsServer';

@injectable()
export class NewsScraperTaskWorker {
  private _id!: string;
  private _prometheusMetricsServerPort?: number;

  private _articleScrapeExpirationTime: number = 60000; // How long should the article URL stay in the queue until it expires?

  constructor(
    @inject(TYPES.NewsScraperManager) private _newsScraperManager: NewsScraperManager,
    @inject(TYPES.NewsScraperMessageBroker) private _newsScraperMessageBroker: NewsScraperMessageBroker,
    @inject(TYPES.PrometheusMetricsServer) private _prometheusMetricsServer: PrometheusMetricsServer
  ) {}

  async start(id: string, prometheusMetricsServerPort?: number) {
    this._id = id;
    this._prometheusMetricsServerPort = prometheusMetricsServerPort;

    logger.info(`========== Starting the worker "${id}" ... ==========`);

    await this._newsScraperMessageBroker.sendToQueue(
      NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_TASK_WORKER_STATUS_UPDATE_QUEUE,
      { status: LifecycleStatusEnum.STARTING, id, prometheusMetricsServerPort }
    );

    if (prometheusMetricsServerPort) {
      await this._prometheusMetricsServer.start(prometheusMetricsServerPort, `news_scraper_task_worker_${id}_`);
    }

    this._startRecentArticlesQueueConsumption(id);
    // TODO: article queue consumption

    await this._newsScraperMessageBroker.sendToQueue(
      NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_TASK_WORKER_STATUS_UPDATE_QUEUE,
      { status: LifecycleStatusEnum.STARTED, id, prometheusMetricsServerPort }
    );

    await new Promise(() => {
      // Together forever and never apart ...
    });
  }

  async terminate(errorMessage?: string) {
    await this._newsScraperMessageBroker.sendToQueue(
      NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_TASK_WORKER_STATUS_UPDATE_QUEUE,
      {
        status: errorMessage ? LifecycleStatusEnum.ERRORED : LifecycleStatusEnum.CLOSED,
        id: this._id,
        prometheusMetricsServerPort: this._prometheusMetricsServerPort,
        errorMessage,
      }
    );
  }

  private async _startRecentArticlesQueueConsumption(id: string) {
    logger.info(`[Worker ${id}] Starting to consume recent articles scrape ...`);

    return this._newsScraperMessageBroker.consumeOneAtTime(
      NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_QUEUE,
      async (data, acknowledgeMessageCallback, negativeAcknowledgeMessageCallback) => {
        logger.debug(`[Worker ${id}] Processing recent articles scrape job. Data ${JSON.stringify(data)}`);

        await this._newsScraperMessageBroker.sendToQueue(
          NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_STATUS_UPDATE_QUEUE,
          { status: ProcessingStatusEnum.PROCESSING, ...data }
        );

        const newsScraper = await this._newsScraperManager.get(data.newsSite);
        if (!newsScraper) {
          const errorMessage = `[Worker ${id}] News scraper "${data.newsSite}" not found. Skipping ...`;

          logger.error(errorMessage);

          negativeAcknowledgeMessageCallback();

          await this._newsScraperMessageBroker.sendToQueue(
            NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_STATUS_UPDATE_QUEUE,
            { status: ProcessingStatusEnum.FAILED, ...data, errorMessage }
          );

          return;
        }

        try {
          const basicArticles = await newsScraper.scrapeRecentArticles();

          for (const basicArticle of basicArticles) {
            await this._newsScraperMessageBroker.sendToQueue(
              NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_ARTICLE_SCRAPE_QUEUE,
              basicArticle,

              { expiration: this._articleScrapeExpirationTime, persistent: true },
              { durable: true }
            );
          }

          acknowledgeMessageCallback();

          await this._newsScraperMessageBroker.sendToQueue(
            NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_STATUS_UPDATE_QUEUE,
            { status: ProcessingStatusEnum.PROCESSED, ...data }
          );
        } catch (err) {
          logger.error(`[Worker ${id}] Error: ${err.message}`);

          negativeAcknowledgeMessageCallback();

          await this._newsScraperMessageBroker.sendToQueue(
            NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_STATUS_UPDATE_QUEUE,
            { status: ProcessingStatusEnum.FAILED, ...data, errorMessage: err.message }
          );
        }
      }
    );
  }
}
