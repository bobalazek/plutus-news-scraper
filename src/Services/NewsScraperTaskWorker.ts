import { inject, injectable } from 'inversify';

import { TYPES } from '../DI/ContainerTypes';
import { NewsMessageBrokerQueuesEnum } from '../Types/NewsMessageBrokerQueues';
import { logger } from './Logger';
import { NewsScraperManager } from './NewsScraperManager';
import { NewsScraperMessageBroker } from './NewsScraperMessageBroker';

@injectable()
export class NewsScraperTaskWorker {
  constructor(
    @inject(TYPES.NewsScraperManager) private _newsScraperManager: NewsScraperManager,
    @inject(TYPES.NewsScraperMessageBroker) private _newsScraperMessageBroker: NewsScraperMessageBroker
  ) {}

  async start(id: string) {
    logger.info(`========== Starting the worker "${id}" ... ==========`);

    this._startRecentArticlesQueueConsumption(id);
    // TODO: article queue consumption

    return new Promise(() => {
      // Together forever and never apart ...
    });
  }

  private async _startRecentArticlesQueueConsumption(id: string) {
    logger.info(`[Worker ${id}] Starting to consume recent articles scrape ...`);

    return this._newsScraperMessageBroker.consumeRecentArticlesScrapeQueue(
      async (data, acknowledgeMessageCallback, negativeAcknowledgeMessageCallback) => {
        logger.debug(`[Worker ${id}] Processing recent articles scrape job. Data ${JSON.stringify(data)}`);

        await this._newsScraperMessageBroker.sendToQueue(
          NewsMessageBrokerQueuesEnum.NEWS_RECENT_ARTICLES_SCRAPE_STARTED,
          data
        );

        const newsScraper = await this._newsScraperManager.get(data.newsSite);
        if (!newsScraper) {
          const errorMessage = `[Worker ${id}] News scraper "${data.newsSite}" not found. Skipping ...`;

          logger.error(errorMessage);

          negativeAcknowledgeMessageCallback();

          await this._newsScraperMessageBroker.sendToQueue(
            NewsMessageBrokerQueuesEnum.NEWS_RECENT_ARTICLES_SCRAPE_FAILED,
            { ...data, errorMessage }
          );

          return;
        }

        try {
          const basicArticles = await newsScraper.scrapeRecentArticles();

          for (const basicArticle of basicArticles) {
            await this._newsScraperMessageBroker.sendToArticleScrapeQueue(
              basicArticle,
              60000 // TODO: think about how long we want to keep this
            );
          }

          acknowledgeMessageCallback();

          await this._newsScraperMessageBroker.sendToQueue(
            NewsMessageBrokerQueuesEnum.NEWS_RECENT_ARTICLES_SCRAPE_COMPLETED,
            data
          );
        } catch (err) {
          logger.error(`[Worker ${id}] Error: ${err.message}`);

          negativeAcknowledgeMessageCallback();

          await this._newsScraperMessageBroker.sendToQueue(
            NewsMessageBrokerQueuesEnum.NEWS_RECENT_ARTICLES_SCRAPE_FAILED,
            { ...data, errorMessage: err.message }
          );
        }
      }
    );
  }
}
