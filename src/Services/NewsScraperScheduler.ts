import { inject, injectable } from 'inversify';

import { TYPES } from '../DI/ContainerTypes';
import { NewsMessageBrokerChannelsDataType, NewsMessageBrokerChannelsEnum } from '../Types/NewsMessageBrokerChannels';
import { logger } from './Logger';
import { NewsScraperManager } from './NewsScraperManager';
import { RabbitMQService } from './RabbitMQService';

@injectable()
export class NewsScraperScheduler {
  constructor(
    @inject(TYPES.NewsScraperManager) private _newsScrapermanager: NewsScraperManager,
    @inject(TYPES.RabbitMQService) private _rabbitMQService: RabbitMQService
  ) {}

  async start() {
    logger.info(`========== Starting the scheduler ... ==========`);

    const scrapers = await this._newsScrapermanager.getAll();

    setInterval(() => {
      for (const scraper of scrapers) {
        this._rabbitMQService.send<NewsMessageBrokerChannelsDataType>(
          NewsMessageBrokerChannelsEnum.NEWS_ARTICLE_SCRAPE,
          {
            newsSite: scraper.key,
          }
        );
      }
    }, 15000);

    return new Promise(() => {
      // Together forever and never apart ...
    });
  }
}
