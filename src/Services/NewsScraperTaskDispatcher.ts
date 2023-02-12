import { inject, injectable } from 'inversify';

import { TYPES } from '../DI/ContainerTypes';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';
import { logger } from './Logger';
import { NewsScraperManager } from './NewsScraperManager';
import { NewsScraperMessageBroker } from './NewsScraperMessageBroker';

@injectable()
export class NewsScraperTaskDispatcher {
  private _scrapeInterval: number = 30000;

  constructor(
    @inject(TYPES.NewsScraperManager) private _newsScraperManager: NewsScraperManager,
    @inject(TYPES.NewsScraperMessageBroker) private _newsScraperMessageBroker: NewsScraperMessageBroker
  ) {}

  async start() {
    logger.info(`========== Starting the task dispatcher ... ==========`);

    const scrapers = await this._newsScraperManager.getAll();

    this._dispatchRecentArticlesScrape(scrapers);

    setInterval(() => {
      this._dispatchRecentArticlesScrape(scrapers);
    }, this._scrapeInterval);

    return new Promise(() => {
      // Together forever and never apart ...
    });
  }

  private async _dispatchRecentArticlesScrape(scrapers: NewsScraperInterface[]) {
    logger.info(`Dispatch news article events for scrapers ...`);

    for (const scraper of scrapers) {
      logger.debug(`Dispatching events for ${scraper.key} ...`);

      this._newsScraperMessageBroker.sendToRecentArticlesScrapeQueue(
        {
          newsSite: scraper.key,
        },
        this._scrapeInterval
      );
    }
  }
}
