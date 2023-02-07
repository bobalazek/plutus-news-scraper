import { inject, injectable } from 'inversify';

import { TYPES } from '../ContainerTypes';
import { logger } from './Logger';
import { NewsScraperManager } from './NewsScraperManager';

@injectable()
export class NewsScraperDaemon {
  constructor(@inject(TYPES.NewsScraperManager) private _newsScrapermanager: NewsScraperManager) {}

  async start() {
    logger.info('========== Starting the daemon ... ==========');

    // TODO

    return new Promise(() => {
      // Together forever and never apart ...
    });
  }

  async shutdown() {
    // TODO
  }
}
