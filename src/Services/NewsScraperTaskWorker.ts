import { inject, injectable } from 'inversify';

import { TYPES } from '../DI/ContainerTypes';
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
    this._startArticleQueuConsumption(id);

    return new Promise(() => {
      // Together forever and never apart ...
    });
  }

  private async _startRecentArticlesQueueConsumption(id: string) {
    logger.info(`[Worker ${id}] Starting to consume recent articles scrape ...`);

    return this._newsScraperMessageBroker.consumeRecentArticlesScrapeQueue(async (data, acknowledgeMessageCallback) => {
      logger.debug(`[Worker ${id}] Processing recent articles scrape job. Data ${JSON.stringify(data)}`);

      const newsSite = data.newsSite;
      const newsScraper = await this._newsScraperManager.get(newsSite);
      if (!newsScraper) {
        logger.error(`[Worker ${id}] News scraper "${newsSite}" not found. Skipping ...`);

        // TODO: should we acknowledge it or put back into the queue?

        acknowledgeMessageCallback();

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
      } catch (err) {
        logger.error(`[Worker ${id}] Error: ${err.message}`);

        // TODO: figure out what we should do in this case. Should we acknowledge it or put back to the queue?

        acknowledgeMessageCallback();
      }
    });
  }

  private async _startArticleQueuConsumption(id: string) {
    logger.info(`[Worker ${id}] Starting to consume article scrape ...`);

    return this._newsScraperMessageBroker.consumeArticleScrapeQueue(async (data, acknowledgeMessageCallback) => {
      logger.debug(`[Worker ${id}] Processing article scrape job. Data ${JSON.stringify(data)}`);

      // TODO

      acknowledgeMessageCallback();
    });
  }
}
