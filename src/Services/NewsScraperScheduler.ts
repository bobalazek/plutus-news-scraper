import { inject, injectable } from 'inversify';

import { TYPES } from '../DI/ContainerTypes';
import { NewsMessageBrokerChannelsEnum } from '../Types/NewsMessageBrokerChannels';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';
import { logger } from './Logger';
import { NewsScraperManager } from './NewsScraperManager';
import { NewsScraperMessageBroker } from './NewsScraperMessageBroker';

@injectable()
export class NewsScraperScheduler {
  private _scrapeInterval: number = 30000;

  constructor(
    @inject(TYPES.NewsScraperManager) private _newsScraperManager: NewsScraperManager,
    @inject(TYPES.NewsScraperMessageBroker) private _newsScraperMessageBroker: NewsScraperMessageBroker
  ) {}

  async start() {
    logger.info(`========== Starting the scheduler ... ==========`);

    const scrapers = await this._newsScraperManager.getAll();

    this._scheduleRecentArticlesScrape(scrapers);

    setInterval(() => {
      this._scheduleRecentArticlesScrape(scrapers);
    }, this._scrapeInterval);

    return new Promise(() => {
      // Together forever and never apart ...
    });
  }

  private async _scheduleRecentArticlesScrape(scrapers: NewsScraperInterface[]) {
    logger.info(`Scheduling news article events for scrapers ...`);

    for (const scraper of scrapers) {
      logger.debug(`Scheduling events for ${scraper.key} ...`);

      this._newsScraperMessageBroker.sendToQueue(
        NewsMessageBrokerChannelsEnum.NEWS_RECENT_ARTICLES_SCRAPE,
        {
          newsSite: scraper.key,
        },
        this._scrapeInterval
      );
    }
  }
}
