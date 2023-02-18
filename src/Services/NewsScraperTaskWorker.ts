import { inject, injectable } from 'inversify';

import { TYPES } from '../DI/ContainerTypes';
import { LifecycleStatusEnum } from '../Types/LifecycleStatusEnum';
import { NewsScraperMessageBrokerQueuesEnum } from '../Types/NewsMessageBrokerQueues';
import { ProcessingStatusEnum } from '../Types/ProcessingStatusEnum';
import { HTTPServerService } from './HTTPServerService';
import { logger } from './Logger';
import { NewsScraperManager } from './NewsScraperManager';
import { NewsScraperMessageBroker } from './NewsScraperMessageBroker';
import { PrometheusService } from './PrometheusService';

type ConsumedQueues = '*' | 'scrape_article' | 'scrape_recent_articles';

@injectable()
export class NewsScraperTaskWorker {
  private _id!: string;
  private _httpServerPort?: number;

  private _scrapeArticleExpirationTime: number = 300000; // 5 minute

  constructor(
    @inject(TYPES.NewsScraperManager) private _newsScraperManager: NewsScraperManager,
    @inject(TYPES.NewsScraperMessageBroker) private _newsScraperMessageBroker: NewsScraperMessageBroker,
    @inject(TYPES.HTTPServerService) private _httpServerService: HTTPServerService,
    @inject(TYPES.PrometheusService) private _prometheusService: PrometheusService
  ) {}

  async start(id: string, httpServerPort?: number, consumedQueues: ConsumedQueues[] = ['*']) {
    this._id = id;
    this._httpServerPort = httpServerPort;

    logger.info(`========== Starting the worker "${id}" ... ==========`);

    await this._sendStatusUpdate(LifecycleStatusEnum.STARTING);

    if (httpServerPort) {
      await this._httpServerService.start(httpServerPort);
      this._prometheusService.addDefaultMetrics({ prefix: `news_scraper_task_worker_${id}_` });
      this._prometheusService.addMetricsEndpointToHttpServer(this._httpServerService.getHttpServer());
    }

    if (consumedQueues.includes('*') || consumedQueues.includes('scrape_recent_articles')) {
      this._startRecentArticlesQueueConsumption(id);
    }

    if (consumedQueues.includes('*') || consumedQueues.includes('scrape_article')) {
      // TODO: article queue consumption
    }

    await this._sendStatusUpdate(LifecycleStatusEnum.STARTED);

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
        httpServerPort: this._httpServerPort,
        errorMessage,
      }
    );
  }

  private async _startRecentArticlesQueueConsumption(id: string) {
    logger.info(`[Worker ${id}] Starting to consume recent articles scrape ...`);

    return this._newsScraperMessageBroker.consumeFromQueueOneAtTime(
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
            // TODO: prevent deduplication

            await this._newsScraperMessageBroker.sendToQueue(
              NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_ARTICLE_SCRAPE_QUEUE,
              basicArticle,
              { expiration: this._scrapeArticleExpirationTime, persistent: true },
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

  private async _sendStatusUpdate(status: LifecycleStatusEnum) {
    return this._newsScraperMessageBroker.sendToQueue(
      NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_TASK_WORKER_STATUS_UPDATE_QUEUE,
      { status, id: this._id, httpServerPort: this._httpServerPort }
    );
  }
}
