import { inject, injectable } from 'inversify';

import { TYPES } from '../ContainerTypes';
import { logger } from './Logger';
import { NewsScraperManager } from './NewsScraperManager';

@injectable()
export class NewsScraperScheduler {
  constructor(@inject(TYPES.NewsScraperManager) private _newsScrapermanager: NewsScraperManager) {}

  async start() {
    logger.info('========== Starting the scheduler ... ==========');

    // TODO

    return new Promise(() => {
      // Together forever and never apart ...
    });
  }

  async shutdown() {
    // TODO
  }
}
