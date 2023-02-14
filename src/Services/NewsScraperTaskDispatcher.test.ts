/// <reference types="jest" />
import { injectable } from 'inversify';

import { container } from '../DI/Container';
import { TYPES } from '../DI/ContainerTypes';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';
import { NewsScraperManager } from './NewsScraperManager';
import { NewsScraperTaskDispatcher } from './NewsScraperTaskDispatcher';

// We need it so we can setup the scrapers in the task dispatcher
@injectable()
class MockNewsScraperManager extends NewsScraperManager {
  getAll(): Promise<NewsScraperInterface[]> {
    return Promise.resolve([
      {
        key: 'test_scraper_1',
        domain: 'test-domain-1.com',
        scrapeRecentArticles: async () => [],
        scrapeArticle: async () => null,
      },
      {
        key: 'test_scraper_2',
        domain: 'test-domain-2.com',
        scrapeRecentArticles: async () => [],
        scrapeArticle: async () => null,
      },
      {
        key: 'test_scraper_3',
        domain: 'test-domain-3.com',
        scrapeRecentArticles: async () => [],
        scrapeArticle: async () => null,
      },
    ]);
  }
}

describe('Services/NewsScraperTaskDispatcher.ts', () => {
  let newsScraperTaskDispatcher: NewsScraperTaskDispatcher;

  beforeAll(() => {
    container.rebind<NewsScraperManager>(TYPES.NewsScraperManager).to(MockNewsScraperManager);

    newsScraperTaskDispatcher = container.get<NewsScraperTaskDispatcher>(TYPES.NewsScraperTaskDispatcher);
  });

  beforeEach(async () => {
    await newsScraperTaskDispatcher.setupScrapers();
  });

  it.each([
    {
      testName: 'initial state',
      scraperStatusMapData: {},
      result: ['test_scraper_1', 'test_scraper_2', 'test_scraper_3'],
    },
  ])('getOrderedScrapers - $testName', ({ scraperStatusMapData, result }) => {
    if (Object.keys(scraperStatusMapData).length > 0) {
      for (const key in scraperStatusMapData) {
        newsScraperTaskDispatcher.setScraperStatusMap(key, scraperStatusMapData[key]);
      }
    }

    const scrapers = newsScraperTaskDispatcher.getOrderedScrapers();
    const scraperKeys = scrapers.map((scraper) => {
      return scraper.key;
    });

    expect(scraperKeys).toStrictEqual(result);
  });
});
