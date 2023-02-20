/// <reference types="jest" />
import { injectable } from 'inversify';

import { container } from '../DI/Container';
import { TYPES } from '../DI/ContainerTypes';
import { NewsArticleMultimediaTypeEnum } from '../Types/NewsArticleMultimediaTypeEnum';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';
import { NewsScraperStatusEntry } from '../Types/NewsScraperStatusEntry';
import { ProcessingStatusEnum } from '../Types/ProcessingStatusEnum';
import { NewsScraperManager } from './NewsScraperManager';
import { NewsScraperTaskDispatcher } from './NewsScraperTaskDispatcher';

// We need it so we can setup the scrapers in the task dispatcher
const baseScraper = {
  scrapeRecentArticles: async () => [],
  scrapeArticle: async () => {
    return {
      url: 'http://test.com',
      title: 'Headline',
      multimediaType: NewsArticleMultimediaTypeEnum.TEXT,
      content: '',
      newsSiteArticleId: '',
      publishedAt: new Date(),
      modifiedAt: new Date(),
    };
  },
};

@injectable()
class MockNewsScraperManager extends NewsScraperManager {
  getAll(): Promise<NewsScraperInterface[]> {
    return Promise.resolve([
      {
        ...baseScraper,
        key: 'test_scraper_1',
        domain: 'test-domain-1.com',
      },
      {
        ...baseScraper,
        key: 'test_scraper_2',
        domain: 'test-domain-2.com',
      },
      {
        ...baseScraper,
        key: 'test_scraper_3',
        domain: 'test-domain-3.com',
      },
      {
        ...baseScraper,
        key: 'test_scraper_4',
        domain: 'test-domain-4.com',
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

  it.each<{ testName: string; scraperStatusMapData: Record<string, NewsScraperStatusEntry>; result: string[] }>([
    {
      testName: 'initial state',
      scraperStatusMapData: {},
      result: ['test_scraper_1', 'test_scraper_2', 'test_scraper_3', 'test_scraper_4'],
    },
    {
      testName: 'first processing',
      scraperStatusMapData: {
        test_scraper_1: {
          status: ProcessingStatusEnum.PROCESSING,
          lastUpdate: new Date('2020-01-01 12:00:00'),
          lastStarted: new Date('2020-01-01 12:00:00'),
          lastProcessed: null,
          lastFailed: null,
          lastFailedErrorMessage: null,
        },
        test_scraper_2: {
          status: ProcessingStatusEnum.PENDING,
          lastUpdate: null,
          lastStarted: null,
          lastProcessed: null,
          lastFailed: null,
          lastFailedErrorMessage: null,
        },
        test_scraper_3: {
          status: ProcessingStatusEnum.PENDING,
          lastUpdate: null,
          lastStarted: null,
          lastProcessed: null,
          lastFailed: null,
          lastFailedErrorMessage: null,
        },
        test_scraper_4: {
          status: ProcessingStatusEnum.PENDING,
          lastUpdate: null,
          lastStarted: null,
          lastProcessed: null,
          lastFailed: null,
          lastFailedErrorMessage: null,
        },
      },
      result: ['test_scraper_2', 'test_scraper_3', 'test_scraper_4'],
    },
    {
      testName: 'first processed, second processing',
      scraperStatusMapData: {
        test_scraper_1: {
          status: ProcessingStatusEnum.PROCESSED,
          lastUpdate: new Date('2020-01-01 12:00:00'),
          lastStarted: new Date('2020-01-01 12:00:00'),
          lastProcessed: new Date('2020-01-01 12:00:10'),
          lastFailed: null,
          lastFailedErrorMessage: null,
        },
        test_scraper_2: {
          status: ProcessingStatusEnum.PROCESSING,
          lastUpdate: new Date('2020-01-01 12:00:10'),
          lastStarted: new Date('2020-01-01 12:00:10'),
          lastProcessed: null,
          lastFailed: null,
          lastFailedErrorMessage: null,
        },
        test_scraper_3: {
          status: ProcessingStatusEnum.PENDING,
          lastUpdate: null,
          lastStarted: null,
          lastProcessed: null,
          lastFailed: null,
          lastFailedErrorMessage: null,
        },
        test_scraper_4: {
          status: ProcessingStatusEnum.PENDING,
          lastUpdate: null,
          lastStarted: null,
          lastProcessed: null,
          lastFailed: null,
          lastFailedErrorMessage: null,
        },
      },
      result: ['test_scraper_3', 'test_scraper_4', 'test_scraper_1'],
    },
    {
      testName: 'all processed',
      scraperStatusMapData: {
        test_scraper_1: {
          status: ProcessingStatusEnum.PROCESSED,
          lastUpdate: new Date('2020-01-01 12:00:00'),
          lastStarted: new Date('2020-01-01 12:00:00'),
          lastProcessed: new Date('2020-01-01 12:00:10'),
          lastFailed: null,
          lastFailedErrorMessage: null,
        },
        test_scraper_2: {
          status: ProcessingStatusEnum.PROCESSED,
          lastUpdate: new Date('2020-01-01 12:00:10'),
          lastStarted: new Date('2020-01-01 12:00:10'),
          lastProcessed: new Date('2020-01-01 12:00:20'),
          lastFailed: null,
          lastFailedErrorMessage: null,
        },
        test_scraper_3: {
          status: ProcessingStatusEnum.PROCESSED,
          lastUpdate: new Date('2020-01-01 12:00:20'),
          lastStarted: new Date('2020-01-01 12:00:20'),
          lastProcessed: new Date('2020-01-01 12:00:30'),
          lastFailed: null,
          lastFailedErrorMessage: null,
        },
        test_scraper_4: {
          status: ProcessingStatusEnum.PROCESSED,
          lastUpdate: new Date('2020-01-01 12:00:30'),
          lastStarted: new Date('2020-01-01 12:00:30'),
          lastProcessed: new Date('2020-01-01 12:00:40'),
          lastFailed: null,
          lastFailedErrorMessage: null,
        },
      },
      result: ['test_scraper_1', 'test_scraper_2', 'test_scraper_3', 'test_scraper_4'],
    },
    {
      testName: 'all processed, #2 processed before #1',
      scraperStatusMapData: {
        test_scraper_1: {
          status: ProcessingStatusEnum.PROCESSED,
          lastUpdate: new Date('2020-01-01 12:00:00'),
          lastStarted: new Date('2020-01-01 12:00:00'),
          lastProcessed: new Date('2020-01-01 12:00:30'),
          lastFailed: null,
          lastFailedErrorMessage: null,
        },
        test_scraper_2: {
          status: ProcessingStatusEnum.PROCESSED,
          lastUpdate: new Date('2020-01-01 12:00:10'),
          lastStarted: new Date('2020-01-01 12:00:10'),
          lastProcessed: new Date('2020-01-01 12:00:20'),
          lastFailed: null,
          lastFailedErrorMessage: null,
        },
        test_scraper_3: {
          status: ProcessingStatusEnum.PROCESSED,
          lastUpdate: new Date('2020-01-01 12:00:20'),
          lastStarted: new Date('2020-01-01 12:00:20'),
          lastProcessed: new Date('2020-01-01 12:00:30'),
          lastFailed: null,
          lastFailedErrorMessage: null,
        },
        test_scraper_4: {
          status: ProcessingStatusEnum.PROCESSED,
          lastUpdate: new Date('2020-01-01 12:00:30'),
          lastStarted: new Date('2020-01-01 12:00:30'),
          lastProcessed: new Date('2020-01-01 12:00:40'),
          lastFailed: null,
          lastFailedErrorMessage: null,
        },
      },
      result: ['test_scraper_2', 'test_scraper_1', 'test_scraper_3', 'test_scraper_4'],
    },
    {
      testName: 'all except #3 processed, #3 failed late',
      scraperStatusMapData: {
        test_scraper_1: {
          status: ProcessingStatusEnum.PROCESSED,
          lastUpdate: new Date('2020-01-01 12:00:00'),
          lastStarted: new Date('2020-01-01 12:00:00'),
          lastProcessed: new Date('2020-01-01 12:00:20'),
          lastFailed: null,
          lastFailedErrorMessage: null,
        },
        test_scraper_2: {
          status: ProcessingStatusEnum.PROCESSED,
          lastUpdate: new Date('2020-01-01 12:00:10'),
          lastStarted: new Date('2020-01-01 12:00:10'),
          lastProcessed: new Date('2020-01-01 12:00:30'),
          lastFailed: null,
          lastFailedErrorMessage: null,
        },
        test_scraper_3: {
          status: ProcessingStatusEnum.FAILED,
          lastUpdate: new Date('2020-01-01 12:00:40'),
          lastStarted: new Date('2020-01-01 12:00:40'),
          lastProcessed: null,
          lastFailed: new Date('2020-01-01 12:00:50'),
          lastFailedErrorMessage: null,
        },
        test_scraper_4: {
          status: ProcessingStatusEnum.PROCESSED,
          lastUpdate: new Date('2020-01-01 12:00:30'),
          lastStarted: new Date('2020-01-01 12:00:30'),
          lastProcessed: new Date('2020-01-01 12:00:40'),
          lastFailed: null,
          lastFailedErrorMessage: null,
        },
      },
      result: ['test_scraper_1', 'test_scraper_2', 'test_scraper_4', 'test_scraper_3'],
    },
    {
      testName: 'all except #3 processed, #3 failed early',
      scraperStatusMapData: {
        test_scraper_1: {
          status: ProcessingStatusEnum.PROCESSED,
          lastUpdate: new Date('2020-01-01 12:00:00'),
          lastStarted: new Date('2020-01-01 12:00:00'),
          lastProcessed: new Date('2020-01-01 12:00:20'),
          lastFailed: null,
          lastFailedErrorMessage: null,
        },
        test_scraper_2: {
          status: ProcessingStatusEnum.PROCESSED,
          lastUpdate: new Date('2020-01-01 12:00:10'),
          lastStarted: new Date('2020-01-01 12:00:10'),
          lastProcessed: new Date('2020-01-01 12:00:30'),
          lastFailed: null,
          lastFailedErrorMessage: null,
        },
        test_scraper_3: {
          status: ProcessingStatusEnum.FAILED,
          lastUpdate: new Date('2020-01-01 12:00:05'),
          lastStarted: new Date('2020-01-01 12:00:05'),
          lastProcessed: null,
          lastFailed: new Date('2020-01-01 12:00:08'),
          lastFailedErrorMessage: null,
        },
        test_scraper_4: {
          status: ProcessingStatusEnum.PROCESSED,
          lastUpdate: new Date('2020-01-01 12:00:30'),
          lastStarted: new Date('2020-01-01 12:00:30'),
          lastProcessed: new Date('2020-01-01 12:00:40'),
          lastFailed: null,
          lastFailedErrorMessage: null,
        },
      },
      result: ['test_scraper_3', 'test_scraper_1', 'test_scraper_2', 'test_scraper_4'],
    },
  ])('getOrderedScrapers - $testName', async ({ scraperStatusMapData, result }) => {
    await newsScraperTaskDispatcher.prepareScraperStatusMap();

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
