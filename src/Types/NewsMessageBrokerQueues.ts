import { LifecycleStatusEnum } from './LifecycleStatusEnum';
import { ProcessingStatusEnum } from './ProcessingStatusEnum';

export enum NewsScraperMessageBrokerQueuesEnum {
  /* ---------- Task ---------- */
  NEWS_SCRAPER_TASK_DISPATCHER_STATUS_UPDATE_QUEUE = 'news_scraper.task_dispatcher.status_update',
  NEWS_SCRAPER_TASK_WORKER_STATUS_UPDATE_QUEUE = 'news_scraper.task_worker.status_update',
  /* ---------- Recent articles ---------- */
  NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_QUEUE = 'news_scraper.recent_articles.scrape',
  NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_STATUS_UPDATE_QUEUE = 'news_scraper.recent_articles.scrape.status_update',
  /* ---------- Recent articles ---------- */
  NEWS_SCRAPER_ARTICLE_SCRAPE_QUEUE = 'news_scraper.article.scrape',
  NEWS_SCRAPER_ARTICLE_SCRAPE_STATUS_UPDATE_QUEUE = 'news_scraper.article.scrape.status_update',
}

export type NewsMessageBrokerQueuesDataType = {
  /* ---------- Task ---------- */
  [NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_TASK_DISPATCHER_STATUS_UPDATE_QUEUE]: {
    status: LifecycleStatusEnum;
    httpServerPort?: number;
    errorMessage?: string;
  };
  [NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_TASK_WORKER_STATUS_UPDATE_QUEUE]: {
    status: LifecycleStatusEnum;
    id: string;
    httpServerPort?: number;
    errorMessage?: string;
  };
  /* ---------- Recent articles ---------- */
  [NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_QUEUE]: {
    newsSite: string;
    url?: string;
  };
  [NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_STATUS_UPDATE_QUEUE]: {
    status: ProcessingStatusEnum;
    newsSite: string;
    url?: string;
    errorMessage?: string;
  };
  /* ---------- Recent articles ---------- */
  [NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_ARTICLE_SCRAPE_QUEUE]: {
    url: string;
  };
  [NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_ARTICLE_SCRAPE_STATUS_UPDATE_QUEUE]: {
    status: ProcessingStatusEnum;
    url: string;
    errorMessage?: string;
  };
};
