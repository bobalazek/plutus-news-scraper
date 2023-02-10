import { inject, injectable } from 'inversify';

import { TYPES } from '../DI/ContainerTypes';
import { NewsMessageBrokerChannelsDataType, NewsMessageBrokerChannelsEnum } from '../Types/NewsMessageBrokerChannels';
import { logger } from './Logger';
import { NewsScraperManager } from './NewsScraperManager';
import { RabbitMQService } from './RabbitMQService';

@injectable()
export class NewsScraperWorker {
  constructor(
    @inject(TYPES.NewsScraperManager) private _newsScraperManager: NewsScraperManager,
    @inject(TYPES.RabbitMQService) private _rabbitMQService: RabbitMQService
  ) {}

  async start(id: string) {
    logger.info(`========== Starting the worker "${id}" ... ==========`);

    this._consumeRecentArticlesScrapeQueue(id);
    this._consumeArticleScrapeQueue(id);

    return new Promise(() => {
      // Together forever and never apart ...
    });
  }

  private async _consumeRecentArticlesScrapeQueue(id: string) {
    logger.info(`[Worker ${id}] Starting to consume recent articles scrape ...`);

    return this._rabbitMQService.consume<NewsMessageBrokerChannelsDataType>(
      NewsMessageBrokerChannelsEnum.NEWS_RECENT_ARTICLES_SCRAPE,
      async (data, message, channel) => {
        logger.debug(`[Worker ${id}] Processing recent articles scrape job. Data ${JSON.stringify(data)}`);

        const newsScraperKey = (data as any).newsScraper; // TODO: fix infer on RabbitMQService side
        const newsScraper = await this._newsScraperManager.get(newsScraperKey);
        if (!newsScraper) {
          logger.error(`[Worker ${id}] News scraper "${newsScraperKey}" not found. Skipping ...`);

          // TODO: should we acknowledge it or put back into the queue?

          return;
        }

        try {
          const basicArticles = await newsScraper.scrapeRecentArticles();

          for (const basicArticle of basicArticles) {
            this._rabbitMQService.send<NewsMessageBrokerChannelsDataType>(
              NewsMessageBrokerChannelsEnum.NEWS_ARTICLE_SCRAPE,
              {
                url: basicArticle.url,
              },
              {
                expiration: 60000, // TODO: think about how long we want to keep this
              }
            );
          }

          channel.ack(message);
        } catch (err) {
          logger.error(`[Worker ${id}] Error: ${err.message}`);

          // TODO: figure out what we should do in this case. Should we acknowledge it or put back to the queue?
          channel.ack(message);
        }
      },
      false
    );
  }

  private async _consumeArticleScrapeQueue(id: string) {
    logger.info(`[Worker ${id}] Starting to consume article scrape ...`);

    return this._rabbitMQService.consume<NewsMessageBrokerChannelsDataType>(
      NewsMessageBrokerChannelsEnum.NEWS_ARTICLE_SCRAPE,
      async (data, message, channel) => {
        logger.debug(`[Worker ${id}] Processing article scrape job. Data ${JSON.stringify(data)}`);

        // TODO

        channel.ack(message);
      },
      false
    );
  }
}
