import { inject, injectable } from 'inversify';

import { TYPES } from '../DI/ContainerTypes';
import { logger } from './Logger';
import { NewsScraperManager } from './NewsScraperManager';

@injectable()
export class NewsScraperWorker {
  constructor(@inject(TYPES.NewsScraperManager) private _newsScrapermanager: NewsScraperManager) {}

  async start(id: string) {
    logger.info(`========== Starting the worker "${id}" ... ==========`);

    // TODO

    return new Promise(() => {
      // Together forever and never apart ...
    });
  }

  async shutdown() {
    // TODO
  }
}
