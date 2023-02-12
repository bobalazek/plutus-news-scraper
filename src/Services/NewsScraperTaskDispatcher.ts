import { inject, injectable } from 'inversify';

import { TYPES } from '../DI/ContainerTypes';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';
import { logger } from './Logger';
import { NewsScraperManager } from './NewsScraperManager';
import { NewsScraperMessageBroker } from './NewsScraperMessageBroker';

@injectable()
export class NewsScraperTaskDispatcher {
  private _scrapeInterval: number = 30000;
  private _messagesCountMonitoringInterval: number = 5000;

  constructor(
    @inject(TYPES.NewsScraperManager) private _newsScraperManager: NewsScraperManager,
    @inject(TYPES.NewsScraperMessageBroker) private _newsScraperMessageBroker: NewsScraperMessageBroker
  ) {}

  async start() {
    logger.info(`========== Starting the task dispatcher ... ==========`);

    const scrapers = await this._newsScraperManager.getAll();

    this._startRecentArticlesScraping(scrapers);
    this._startMessageQueuesMonitoring();

    return new Promise(() => {
      // Together forever and never apart ...
    });
  }

  private _startRecentArticlesScraping(scrapers: NewsScraperInterface[]) {
    this._dispatchRecentArticlesScrape(scrapers);

    setInterval(async () => {
      await this._dispatchRecentArticlesScrape(scrapers);
    }, this._scrapeInterval);

    // TODO: listen to the started, completed and failed queues to see which queue was successfully processed
    // so we can use that to prepare a map of newsSites that need to be scraped
  }

  private _startMessageQueuesMonitoring() {
    setInterval(async () => {
      const messagesCountMap = await this._newsScraperMessageBroker.getMessageCountInAllQueues();

      logger.info(`Messages count map: ${JSON.stringify(messagesCountMap)}`);
    }, this._messagesCountMonitoringInterval);
  }

  private async _dispatchRecentArticlesScrape(scrapers: NewsScraperInterface[]) {
    logger.info(`Dispatch news article events for scrapers ...`);

    for (const scraper of scrapers) {
      logger.debug(`Dispatching events for ${scraper.key} ...`);

      // TODO: log when last time that newsSite was scraped (or we started scraping) was,
      // and prevent adding it if there are other newsSites that need to be scraped sooner

      await this._newsScraperMessageBroker.sendToRecentArticlesScrapeQueue(
        {
          newsSite: scraper.key,
        },
        this._scrapeInterval
      );
    }
  }
}
