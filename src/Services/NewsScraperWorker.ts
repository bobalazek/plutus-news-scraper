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
        logger.debug(`[Worker ${id}] Consuming recent articles scrape job. Data ${JSON.stringify(data)}`);

        // TODO

        channel.ack(message);
      },
      false
    );
  }

  private async _consumeArticleScrapeQueue(id: string) {
    logger.info(`[Worker ${id}] Starting to consume article scrape ...`);

    return this._rabbitMQService.consume<NewsMessageBrokerChannelsDataType>(
      NewsMessageBrokerChannelsEnum.NEWS_ARTICLE_SCRAPE,
      async (data, message, channel) => {
        logger.debug(`[Worker ${id}] Consuming article scrape job. Data ${JSON.stringify(data)}`);

        // TODO

        channel.ack(message);
      },
      false
    );
  }
}
