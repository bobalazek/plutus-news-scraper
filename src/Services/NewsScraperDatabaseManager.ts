import { injectable } from 'inversify';

import { logger } from './Logger';

@injectable()
export class NewsScraperDatabaseManager {
  async init() {
    logger.info(`========== Initializing the database ... ==========`);

    // TODO
  }

  async reset() {
    logger.info(`========== Resetting the database ... ==========`);

    // TODO
  }
}
