import { inject, injectable } from 'inversify';

import { TYPES } from '../ContainerTypes';
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
      // TODO: schedule the recent articles scrape
    }, 15000);

    return new Promise(() => {
      // Together forever and never apart ...
    });
  }
}
