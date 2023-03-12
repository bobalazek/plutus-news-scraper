export enum NewsScraperMessageBrokerQueuesEnum {
  NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_QUEUE = 'news_scraper.recent_articles.scrape',
  NEWS_SCRAPER_ARTICLE_SCRAPE_QUEUE = 'news_scraper.article.scrape',
}

export type NewsMessageBrokerQueuesDataType = {
  [NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_QUEUE]: {
    newsSite: string;
    url?: string;
    scrapeRunId?: string;
  };
  [NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_ARTICLE_SCRAPE_QUEUE]: {
    url: string;
    scrapeRunId?: string;
  };
};
