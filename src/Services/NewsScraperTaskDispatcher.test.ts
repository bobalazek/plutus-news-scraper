/// <reference types="jest" />
import { injectable } from 'inversify';
import { DataSource } from 'typeorm';

import { container } from '../DI/Container';
import { TYPES } from '../DI/ContainerTypes';
import { ScrapeRun } from '../Entitites/ScrapeRun';
import { NewsArticleMultimediaTypeEnum } from '../Types/NewsArticleMultimediaTypeEnum';
import { NewsScraperMessageBrokerQueuesEnum } from '../Types/NewsMessageBrokerQueues';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';
import { ProcessingStatusEnum } from '../Types/ProcessingStatusEnum';
import { NewsScraperDatabase } from './NewsScraperDatabase';
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

@injectable()
class MockNewsScraperDatabase extends NewsScraperDatabase {
  async getDataSource() {
    const dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [ScrapeRun],
      synchronize: true,
      dropSchema: true,
    });

    await dataSource.initialize();

    return Promise.resolve(dataSource);
  }
}

describe('Services/NewsScraperTaskDispatcher.ts', () => {
  const queue = NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_QUEUE;

  let newsScraperTaskDispatcher: NewsScraperTaskDispatcher;
  let newsScraperDatabase: NewsScraperDatabase;

  beforeAll(() => {
    container.rebind<NewsScraperManager>(TYPES.NewsScraperManager).to(MockNewsScraperManager);
    container.rebind<MockNewsScraperDatabase>(TYPES.NewsScraperDatabase).to(MockNewsScraperDatabase);

    newsScraperTaskDispatcher = container.get<NewsScraperTaskDispatcher>(TYPES.NewsScraperTaskDispatcher);
    newsScraperDatabase = container.get<MockNewsScraperDatabase>(TYPES.NewsScraperDatabase);
  });

  it.each<{ testName: string; scrapeRuns: ScrapeRun[]; result: string[] }>([
    {
      testName: 'initial state',
      scrapeRuns: [],
      result: ['test_scraper_1', 'test_scraper_2', 'test_scraper_3', 'test_scraper_4'],
    },
    {
      testName: 'first processing',
      scrapeRuns: [
        {
          id: '1',
          type: queue,
          status: ProcessingStatusEnum.PROCESSING,
          arguments: {
            newsSite: 'test_scraper_1',
          },
          startedAt: new Date('2020-01-01 12:00:00'),
          completedAt: null,
          failedAt: null,
          failedErrorMessage: null,
          updatedAt: new Date('2020-01-01 12:00:00'),
          createdAt: new Date('2020-01-01 12:00:00'),
        },
        {
          id: '2',
          type: queue,
          status: ProcessingStatusEnum.PENDING,
          arguments: {
            newsSite: 'test_scraper_2',
          },
          startedAt: null,
          completedAt: null,
          failedAt: null,
          failedErrorMessage: null,
          updatedAt: new Date('2020-01-01 12:00:00'),
          createdAt: new Date('2020-01-01 12:00:00'),
        },
        {
          id: '3',
          type: queue,
          status: ProcessingStatusEnum.PENDING,
          arguments: {
            newsSite: 'test_scraper_3',
          },
          startedAt: null,
          completedAt: null,
          failedAt: null,
          failedErrorMessage: null,
          updatedAt: new Date('2020-01-01 12:00:00'),
          createdAt: new Date('2020-01-01 12:00:00'),
        },
        {
          id: '4',
          type: queue,
          status: ProcessingStatusEnum.PENDING,
          arguments: {
            newsSite: 'test_scraper_4',
          },
          startedAt: null,
          completedAt: null,
          failedAt: null,
          failedErrorMessage: null,
          updatedAt: new Date('2020-01-01 12:00:00'),
          createdAt: new Date('2020-01-01 12:00:00'),
        },
      ],
      result: ['test_scraper_2', 'test_scraper_3', 'test_scraper_4'],
    },
    {
      testName: 'first processed, second processing',
      scrapeRuns: [
        {
          id: '1',
          type: queue,
          status: ProcessingStatusEnum.PROCESSED,
          arguments: {
            newsSite: 'test_scraper_1',
          },
          startedAt: new Date('2020-01-01 12:00:00'),
          completedAt: new Date('2020-01-01 12:00:10'),
          failedAt: null,
          failedErrorMessage: null,
          updatedAt: new Date('2020-01-01 12:00:00'),
          createdAt: new Date('2020-01-01 12:00:00'),
        },
        {
          id: '2',
          type: queue,
          status: ProcessingStatusEnum.PROCESSING,
          arguments: {
            newsSite: 'test_scraper_2',
          },
          startedAt: new Date('2020-01-01 12:00:10'),
          completedAt: null,
          failedAt: null,
          failedErrorMessage: null,
          updatedAt: new Date('2020-01-01 12:00:10'),
          createdAt: new Date('2020-01-01 12:00:00'),
        },
        {
          id: '3',
          type: queue,
          status: ProcessingStatusEnum.PENDING,
          arguments: {
            newsSite: 'test_scraper_3',
          },
          startedAt: null,
          completedAt: null,
          failedAt: null,
          failedErrorMessage: null,
          updatedAt: new Date('2020-01-01 12:00:00'),
          createdAt: new Date('2020-01-01 12:00:00'),
        },
        {
          id: '4',
          type: queue,
          status: ProcessingStatusEnum.PENDING,
          arguments: {
            newsSite: 'test_scraper_4',
          },
          startedAt: null,
          completedAt: null,
          failedAt: null,
          failedErrorMessage: null,
          updatedAt: new Date('2020-01-01 12:00:00'),
          createdAt: new Date('2020-01-01 12:00:00'),
        },
      ],
      result: ['test_scraper_3', 'test_scraper_4', 'test_scraper_1'],
    },
    {
      testName: 'all processed',
      scrapeRuns: [
        {
          id: '1',
          type: queue,
          status: ProcessingStatusEnum.PROCESSED,
          arguments: {
            newsSite: 'test_scraper_1',
          },
          startedAt: new Date('2020-01-01 12:00:00'),
          completedAt: new Date('2020-01-01 12:00:10'),
          failedAt: null,
          failedErrorMessage: null,
          updatedAt: new Date('2020-01-01 12:00:10'),
          createdAt: new Date('2020-01-01 12:00:00'),
        },
        {
          id: '2',
          type: queue,
          status: ProcessingStatusEnum.PROCESSED,
          arguments: {
            newsSite: 'test_scraper_2',
          },
          startedAt: new Date('2020-01-01 12:00:10'),
          completedAt: new Date('2020-01-01 12:00:20'),
          failedAt: null,
          failedErrorMessage: null,
          updatedAt: new Date('2020-01-01 12:00:20'),
          createdAt: new Date('2020-01-01 12:00:00'),
        },
        {
          id: '3',
          type: queue,
          status: ProcessingStatusEnum.PROCESSED,
          arguments: {
            newsSite: 'test_scraper_3',
          },
          startedAt: new Date('2020-01-01 12:00:20'),
          completedAt: new Date('2020-01-01 12:00:30'),
          failedAt: null,
          failedErrorMessage: null,
          updatedAt: new Date('2020-01-01 12:00:30'),
          createdAt: new Date('2020-01-01 12:00:00'),
        },
        {
          id: '4',
          type: queue,
          status: ProcessingStatusEnum.PROCESSED,
          arguments: {
            newsSite: 'test_scraper_4',
          },
          startedAt: new Date('2020-01-01 12:00:30'),
          completedAt: new Date('2020-01-01 12:00:40'),
          failedAt: null,
          failedErrorMessage: null,
          updatedAt: new Date('2020-01-01 12:00:40'),
          createdAt: new Date('2020-01-01 12:00:00'),
        },
      ],
      result: ['test_scraper_1', 'test_scraper_2', 'test_scraper_3', 'test_scraper_4'],
    },
    {
      testName: 'all processed, #2 processed before #1',
      scrapeRuns: [
        {
          id: '1',
          type: queue,
          status: ProcessingStatusEnum.PROCESSED,
          arguments: {
            newsSite: 'test_scraper_1',
          },
          startedAt: new Date('2020-01-01 12:00:00'),
          completedAt: new Date('2020-01-01 12:00:25'),
          failedAt: null,
          failedErrorMessage: null,
          updatedAt: new Date('2020-01-01 12:00:10'),
          createdAt: new Date('2020-01-01 12:00:00'),
        },
        {
          id: '2',
          type: queue,
          status: ProcessingStatusEnum.PROCESSED,
          arguments: {
            newsSite: 'test_scraper_2',
          },
          startedAt: new Date('2020-01-01 12:00:10'),
          completedAt: new Date('2020-01-01 12:00:20'),
          failedAt: null,
          failedErrorMessage: null,
          updatedAt: new Date('2020-01-01 12:00:20'),
          createdAt: new Date('2020-01-01 12:00:00'),
        },
        {
          id: '3',
          type: queue,
          status: ProcessingStatusEnum.PROCESSED,
          arguments: {
            newsSite: 'test_scraper_3',
          },
          startedAt: new Date('2020-01-01 12:00:20'),
          completedAt: new Date('2020-01-01 12:00:30'),
          failedAt: null,
          failedErrorMessage: null,
          updatedAt: new Date('2020-01-01 12:00:30'),
          createdAt: new Date('2020-01-01 12:00:00'),
        },
        {
          id: '4',
          type: queue,
          status: ProcessingStatusEnum.PROCESSED,
          arguments: {
            newsSite: 'test_scraper_4',
          },
          startedAt: new Date('2020-01-01 12:00:30'),
          completedAt: new Date('2020-01-01 12:00:40'),
          failedAt: null,
          failedErrorMessage: null,
          updatedAt: new Date('2020-01-01 12:00:40'),
          createdAt: new Date('2020-01-01 12:00:00'),
        },
      ],
      result: ['test_scraper_2', 'test_scraper_1', 'test_scraper_3', 'test_scraper_4'],
    },
    {
      testName: 'all except #3 processed, #3 failed late',
      scrapeRuns: [
        {
          id: '1',
          type: queue,
          status: ProcessingStatusEnum.PROCESSED,
          arguments: {
            newsSite: 'test_scraper_1',
          },
          startedAt: new Date('2020-01-01 12:00:00'),
          completedAt: new Date('2020-01-01 12:00:25'),
          failedAt: null,
          failedErrorMessage: null,
          updatedAt: new Date('2020-01-01 12:00:10'),
          createdAt: new Date('2020-01-01 12:00:00'),
        },
        {
          id: '2',
          type: queue,
          status: ProcessingStatusEnum.PROCESSED,
          arguments: {
            newsSite: 'test_scraper_2',
          },
          startedAt: new Date('2020-01-01 12:00:10'),
          completedAt: new Date('2020-01-01 12:00:20'),
          failedAt: null,
          failedErrorMessage: null,
          updatedAt: new Date('2020-01-01 12:00:20'),
          createdAt: new Date('2020-01-01 12:00:00'),
        },
        {
          id: '3',
          type: queue,
          status: ProcessingStatusEnum.FAILED,
          arguments: {
            newsSite: 'test_scraper_3',
          },
          startedAt: new Date('2020-01-01 12:00:20'),
          completedAt: null,
          failedAt: new Date('2020-01-01 12:00:50'),
          failedErrorMessage: null,
          updatedAt: new Date('2020-01-01 12:00:50'),
          createdAt: new Date('2020-01-01 12:00:00'),
        },
        {
          id: '4',
          type: queue,
          status: ProcessingStatusEnum.PROCESSED,
          arguments: {
            newsSite: 'test_scraper_4',
          },
          startedAt: new Date('2020-01-01 12:00:30'),
          completedAt: new Date('2020-01-01 12:00:40'),
          failedAt: null,
          failedErrorMessage: null,
          updatedAt: new Date('2020-01-01 12:00:40'),
          createdAt: new Date('2020-01-01 12:00:00'),
        },
      ],
      result: ['test_scraper_1', 'test_scraper_2', 'test_scraper_4', 'test_scraper_3'],
    },
    {
      testName: 'all except #3 processed, #3 failed early',
      scrapeRuns: [
        {
          id: '1',
          type: queue,
          status: ProcessingStatusEnum.PROCESSED,
          arguments: {
            newsSite: 'test_scraper_1',
          },
          startedAt: new Date('2020-01-01 12:00:00'),
          completedAt: new Date('2020-01-01 12:00:25'),
          failedAt: null,
          failedErrorMessage: null,
          updatedAt: new Date('2020-01-01 12:00:10'),
          createdAt: new Date('2020-01-01 12:00:00'),
        },
        {
          id: '2',
          type: queue,
          status: ProcessingStatusEnum.PROCESSED,
          arguments: {
            newsSite: 'test_scraper_2',
          },
          startedAt: new Date('2020-01-01 12:00:10'),
          completedAt: new Date('2020-01-01 12:00:20'),
          failedAt: null,
          failedErrorMessage: null,
          updatedAt: new Date('2020-01-01 12:00:20'),
          createdAt: new Date('2020-01-01 12:00:00'),
        },
        {
          id: '3',
          type: queue,
          status: ProcessingStatusEnum.FAILED,
          arguments: {
            newsSite: 'test_scraper_3',
          },
          startedAt: new Date('2020-01-01 12:00:05'),
          completedAt: null,
          failedAt: new Date('2020-01-01 12:00:08'),
          failedErrorMessage: null,
          updatedAt: new Date('2020-01-01 12:00:08'),
          createdAt: new Date('2020-01-01 12:00:00'),
        },
        {
          id: '4',
          type: queue,
          status: ProcessingStatusEnum.PROCESSED,
          arguments: {
            newsSite: 'test_scraper_4',
          },
          startedAt: new Date('2020-01-01 12:00:30'),
          completedAt: new Date('2020-01-01 12:00:40'),
          failedAt: null,
          failedErrorMessage: null,
          updatedAt: new Date('2020-01-01 12:00:40'),
          createdAt: new Date('2020-01-01 12:00:00'),
        },
      ],
      result: ['test_scraper_3', 'test_scraper_1', 'test_scraper_2', 'test_scraper_4'],
    },
  ])('getSortedScrapers - $testName', async ({ scrapeRuns, result }) => {
    await newsScraperTaskDispatcher.prepare();

    const dataSource = await newsScraperDatabase.getDataSource();
    const scrapeRunRepository = dataSource.getRepository(ScrapeRun);

    await scrapeRunRepository.clear();
    await scrapeRunRepository.save(scrapeRuns);

    const scrapers = await newsScraperTaskDispatcher.getSortedScrapers();
    const scraperKeys = scrapers.map((scraper) => {
      return scraper.key;
    });

    expect(scraperKeys).toStrictEqual(result);
  });
});
