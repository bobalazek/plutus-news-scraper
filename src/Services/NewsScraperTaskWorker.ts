import { inject, injectable } from 'inversify';

import { TYPES } from '../DI/ContainerTypes';
import { NewsArticle } from '../Entitites/NewsArticle';
import { LifecycleStatusEnum } from '../Types/LifecycleStatusEnum';
import { NewsScraperMessageBrokerQueuesEnum } from '../Types/NewsMessageBrokerQueues';
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
export class NewsScraperTaskWorker {
  private _id!: string;
  private _httpServerPort?: number;
  private _consumedQueues!: string[];

  private _terminationStarted: boolean = false;
  private _recentArticlesConsumptionInProgress: boolean = false;
  private _articleConsumptionInProgress: boolean = false;
  private _scrapeArticleExpirationTime: number = 300000; // 5 minute

  constructor(
    @inject(TYPES.Logger) private _logger: Logger,
    @inject(TYPES.NewsScraperManager) private _newsScraperManager: NewsScraperManager,
    @inject(TYPES.NewsScraperMessageBroker) private _newsScraperMessageBroker: NewsScraperMessageBroker,
    @inject(TYPES.NewsScraperDatabase) private _newsScraperDatabase: NewsScraperDatabase,
    @inject(TYPES.HTTPServerService) private _httpServerService: HTTPServerService,
    @inject(TYPES.PrometheusService) private _prometheusService: PrometheusService
  ) {}

  async start(id: string, httpServerPort?: number, consumedQueues: string[] = ['*']) {
    this._id = id;
    this._httpServerPort = httpServerPort;
    this._consumedQueues = consumedQueues;

    this._logger.info(`========== Starting the worker "${id}" ... ==========`);

    this._registerTerminate();

    await this._sendWorkerStatusUpdate(LifecycleStatusEnum.STARTING);

    await this._registerMetrics();

    this._startConsumption();

    await this._sendWorkerStatusUpdate(LifecycleStatusEnum.STARTED);

    await new Promise(() => {
      // Together forever and never apart ...
    });
  }

  async terminate(errorMessage?: string) {
    if (errorMessage) {
      this._logger.error(`Terminating news scraper task worker with error: ${errorMessage}`);
    } else {
      this._logger.info(`Terminating news scraper task worker`);
    }

    this._terminationStarted = true;

    await this._newsScraperMessageBroker.sendToQueue(
      NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_TASK_WORKER_STATUS_UPDATE_QUEUE,
      {
        status: errorMessage ? LifecycleStatusEnum.ERRORED : LifecycleStatusEnum.CLOSING,
        id: this._id,
        httpServerPort: this._httpServerPort,
        errorMessage,
      }
    );

    await new Promise((resolve) => {
      const consumptionInterval = setInterval(() => {
        if (!this._recentArticlesConsumptionInProgress && !this._articleConsumptionInProgress) {
          clearInterval(consumptionInterval);

          resolve(void 0);
        }
      }, 100);

      setTimeout(() => {
        clearInterval(consumptionInterval);

        resolve(void 0);
      }, 30000);
    });

    await this._newsScraperManager.terminateScraper(true);

    await this._newsScraperMessageBroker.terminate();
    await this._httpServerService.terminate();
    await this._newsScraperDatabase.terminate();

    // Make sure we give out logger enough time to send the last batch of logs
    await sleep(LOKI_PINO_BATCH_INTERVAL_SECONDS * 1000 * 1.2 /* a bit of buffer accounting for network latency */);

    process.exit(errorMessage ? 1 : 0);
  }

  private async _startRecentArticlesQueueConsumption() {
    this._logger.info(`[Worker ${this._id}] Starting to consume recent articles scrape queue ...`);

    return this._newsScraperMessageBroker.consumeFromQueueOneAtTime(
      NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_QUEUE,
      async (data, acknowledgeMessageCallback, negativeAcknowledgeMessageCallback) => {
        if (this._terminationStarted) {
          await this._newsScraperMessageBroker.deleteQueue(
            NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_QUEUE
          );

          return;
        }

        this._logger.debug(
          `[Worker ${this._id}][Recent Articles Queue] Processing recent articles scrape job. Data ${JSON.stringify(
            data
          )}`
        );

        this._recentArticlesConsumptionInProgress = true;

        await this._newsScraperMessageBroker.sendToQueue(
          NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_STATUS_UPDATE_QUEUE,
          { ...data, status: ProcessingStatusEnum.PROCESSING }
        );

        const newsScraper = await this._newsScraperManager.get(data.newsSite);
        if (!newsScraper) {
          const errorMessage = `[Worker ${this._id}][Recent Articles Queue] News scraper "${data.newsSite}" not found. Skipping ...`;

          this._logger.error(errorMessage);

          negativeAcknowledgeMessageCallback();

          await this._newsScraperMessageBroker.sendToQueue(
            NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_STATUS_UPDATE_QUEUE,
            { ...data, status: ProcessingStatusEnum.FAILED, errorMessage }
          );

          this._recentArticlesConsumptionInProgress = false;

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
          this._logger.error(`[Worker ${this._id}][Recent Articles Queue] Error: ${err.message}`);

          negativeAcknowledgeMessageCallback();

          await this._newsScraperMessageBroker.sendToQueue(
            NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_STATUS_UPDATE_QUEUE,
            { ...data, status: ProcessingStatusEnum.FAILED, errorMessage: err.message }
          );
        } finally {
          this._recentArticlesConsumptionInProgress = false;
        }
      }
    );
  }

  private async _startArticleQueueConsumption() {
    this._logger.info(`[Worker ${this._id}] Starting to consume article scrape queue ...`);

    const dataSource = await this._newsScraperDatabase.getDataSource();
    const newsArticleRepository = dataSource.getRepository(NewsArticle);

    return this._newsScraperMessageBroker.consumeFromQueueOneAtTime(
      NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_ARTICLE_SCRAPE_QUEUE,
      async (data, acknowledgeMessageCallback, negativeAcknowledgeMessageCallback) => {
        if (this._terminationStarted) {
          await this._newsScraperMessageBroker.deleteQueue(
            NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_ARTICLE_SCRAPE_QUEUE
          );

          return;
        }

        this._logger.debug(
          `[Worker ${this._id}][Article Queue] Processing recent articles scrape job. Data ${JSON.stringify(data)}`
        );

        this._articleConsumptionInProgress = true;

        await this._newsScraperMessageBroker.sendToQueue(
          NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_ARTICLE_SCRAPE_STATUS_UPDATE_QUEUE,
          { ...data, status: ProcessingStatusEnum.PROCESSING }
        );

        const newsScraper = await this._newsScraperManager.getForUrl(data.url);
        if (!newsScraper) {
          const errorMessage = `[Worker ${this._id}][Article Queue] News scraper for URL "${data.url}" not found. Skipping ...`;

          this._logger.error(errorMessage);

          negativeAcknowledgeMessageCallback();

          await this._newsScraperMessageBroker.sendToQueue(
            NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_ARTICLE_SCRAPE_STATUS_UPDATE_QUEUE,
            { ...data, status: ProcessingStatusEnum.FAILED, errorMessage }
          );

          this._articleConsumptionInProgress = false;

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
          this._logger.error(`[Worker ${this._id}][Article Queue] Error: ${err.message}`);

          negativeAcknowledgeMessageCallback();

          await this._newsScraperMessageBroker.sendToQueue(
            NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_ARTICLE_SCRAPE_STATUS_UPDATE_QUEUE,
            { ...data, status: ProcessingStatusEnum.FAILED, errorMessage: err.message }
          );
        } finally {
          this._articleConsumptionInProgress = false;
        }
      }
    );
  }

  private _startConsumption() {
    this._newsScraperManager.setPreventClose(true);

    if (this._consumedQueues.includes('*') || this._consumedQueues.includes('scrape_recent_articles')) {
      this._startRecentArticlesQueueConsumption();
    }

    if (this._consumedQueues.includes('*') || this._consumedQueues.includes('scrape_article')) {
      this._startArticleQueueConsumption();
    }
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
    this._prometheusService.addDefaultMetrics({ prefix: `news_scraper_task_worker_${this._id}_` });

    if (this._httpServerPort) {
      await this._httpServerService.start(this._httpServerPort, () => {
        this._prometheusService.addMetricsEndpointToExpressApp(this._httpServerService.getExpressApp());
      });
    }
  }

  private async _sendWorkerStatusUpdate(status: LifecycleStatusEnum) {
    return this._newsScraperMessageBroker.sendToQueue(
      NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_TASK_WORKER_STATUS_UPDATE_QUEUE,
      { status, id: this._id, httpServerPort: this._httpServerPort }
    );
  }
}
