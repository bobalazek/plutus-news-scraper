import { inject, injectable } from 'inversify';

import { TYPES } from '../DI/ContainerTypes';
import { NewsArticle } from '../Entitites/NewsArticle';
import { LifecycleStatusEnum } from '../Types/LifecycleStatusEnum';
import { NewsScraperMessageBrokerQueuesEnum } from '../Types/NewsMessageBrokerQueues';
import { ProcessingStatusEnum } from '../Types/ProcessingStatusEnum';
import { HTTPServerService } from './HTTPServerService';
import { logger } from './Logger';
import { NewsScraperDatabase } from './NewsScraperDatabase';
import { NewsScraperManager } from './NewsScraperManager';
import { NewsScraperMessageBroker } from './NewsScraperMessageBroker';
import { PrometheusService } from './PrometheusService';

@injectable()
export class NewsScraperTaskWorker {
  private _id!: string;
  private _httpServerPort?: number;

  private _scrapeArticleExpirationTime: number = 300000; // 5 minute

  constructor(
    @inject(TYPES.NewsScraperManager) private _newsScraperManager: NewsScraperManager,
    @inject(TYPES.NewsScraperMessageBroker) private _newsScraperMessageBroker: NewsScraperMessageBroker,
    @inject(TYPES.NewsScraperDatabase) private _newsScraperDatabase: NewsScraperDatabase,
    @inject(TYPES.HTTPServerService) private _httpServerService: HTTPServerService,
    @inject(TYPES.PrometheusService) private _prometheusService: PrometheusService
  ) {}

  async start(id: string, httpServerPort?: number, consumedQueues: string[] = ['*']) {
    this._id = id;
    this._httpServerPort = httpServerPort;

    logger.info(`========== Starting the worker "${id}" ... ==========`);

    await this._sendStatusUpdate(LifecycleStatusEnum.STARTING);

    // Metrics
    this._prometheusService.addDefaultMetrics({ prefix: `news_scraper_task_worker_${id}_` });

    if (httpServerPort) {
      await this._httpServerService.start(httpServerPort, (httpServer) => {
        this._prometheusService.addMetricsEndpointToHttpServer(httpServer);
      });
    }

    if (consumedQueues.includes('*') || consumedQueues.includes('scrape_recent_articles')) {
      this._startRecentArticlesQueueConsumption();
    }

    if (consumedQueues.includes('*') || consumedQueues.includes('scrape_article')) {
      this._startArticleQueueConsumption();
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

  private async _startRecentArticlesQueueConsumption() {
    logger.info(`[Worker ${this._id}] Starting to consume recent articles scrape queue ...`);

    return this._newsScraperMessageBroker.consumeFromQueueOneAtTime(
      NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_QUEUE,
      async (data, acknowledgeMessageCallback, negativeAcknowledgeMessageCallback) => {
        logger.debug(`[Worker ${this._id}] Processing recent articles scrape job. Data ${JSON.stringify(data)}`);

        await this._newsScraperMessageBroker.sendToQueue(
          NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_STATUS_UPDATE_QUEUE,
          { ...data, status: ProcessingStatusEnum.PROCESSING }
        );

        const newsScraper = await this._newsScraperManager.get(data.newsSite);
        if (!newsScraper) {
          const errorMessage = `[Worker ${this._id}] News scraper "${data.newsSite}" not found. Skipping ...`;

          logger.error(errorMessage);

          negativeAcknowledgeMessageCallback();

          await this._newsScraperMessageBroker.sendToQueue(
            NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_STATUS_UPDATE_QUEUE,
            { ...data, status: ProcessingStatusEnum.FAILED, errorMessage }
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
            { ...data, status: ProcessingStatusEnum.PROCESSED }
          );
        } catch (err) {
          logger.error(`[Worker ${this._id}] Error: ${err.message}`);

          negativeAcknowledgeMessageCallback();

          await this._newsScraperMessageBroker.sendToQueue(
            NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_STATUS_UPDATE_QUEUE,
            { ...data, status: ProcessingStatusEnum.FAILED, errorMessage: err.message }
          );
        }
      }
    );
  }

  private async _startArticleQueueConsumption() {
    logger.info(`[Worker ${this._id}] Starting to consume article scrape queue ...`);

    const dataSource = await this._newsScraperDatabase.getDataSource();
    const newsArticleRepository = dataSource.getRepository(NewsArticle);

    return this._newsScraperMessageBroker.consumeFromQueueOneAtTime(
      NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_ARTICLE_SCRAPE_QUEUE,
      async (data, acknowledgeMessageCallback, negativeAcknowledgeMessageCallback) => {
        logger.debug(`[Worker ${this._id}] Processing recent articles scrape job. Data ${JSON.stringify(data)}`);

        await this._newsScraperMessageBroker.sendToQueue(
          NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_ARTICLE_SCRAPE_STATUS_UPDATE_QUEUE,
          { ...data, status: ProcessingStatusEnum.PROCESSING }
        );

        const newsScraper = await this._newsScraperManager.getForUrl(data.url);
        if (!newsScraper) {
          const errorMessage = `[Worker ${this._id}] News scraper for URL "${data.url}" not found. Skipping ...`;

          logger.error(errorMessage);

          negativeAcknowledgeMessageCallback();

          await this._newsScraperMessageBroker.sendToQueue(
            NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_ARTICLE_SCRAPE_STATUS_UPDATE_QUEUE,
            { ...data, status: ProcessingStatusEnum.FAILED, errorMessage }
          );

          return;
        }

        try {
          const article = await newsScraper.scrapeArticle(data);

          const newsArticle = newsArticleRepository.create(article);

          await newsArticleRepository.save(newsArticle);

          acknowledgeMessageCallback();

          await this._newsScraperMessageBroker.sendToQueue(
            NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_ARTICLE_SCRAPE_STATUS_UPDATE_QUEUE,
            { ...data, status: ProcessingStatusEnum.PROCESSED }
          );
        } catch (err) {
          logger.error(`[Worker ${this._id}] Error: ${err.message}`);

          negativeAcknowledgeMessageCallback();

          await this._newsScraperMessageBroker.sendToQueue(
            NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_ARTICLE_SCRAPE_STATUS_UPDATE_QUEUE,
            { ...data, status: ProcessingStatusEnum.FAILED, errorMessage: err.message }
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
