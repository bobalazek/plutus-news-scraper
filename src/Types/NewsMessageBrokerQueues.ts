export enum NewsMessageBrokerQueuesEnum {
  NEWS_RECENT_ARTICLES_SCRAPE = 'news.recent_articles.scrape',
  NEWS_RECENT_ARTICLES_SCRAPE_STARTED = 'news.recent_articles.scrape.started',
  NEWS_RECENT_ARTICLES_SCRAPE_COMPLETED = 'news.recent_articles.scrape.completed',
  NEWS_RECENT_ARTICLES_SCRAPE_FAILED = 'news.recent_articles.scrape.failed',
  NEWS_ARTICLE_SCRAPE = 'news.article.scrape',
  NEWS_ARTICLE_SCRAPE_STARTED = 'news.article.scrape.started',
  NEWS_ARTICLE_SCRAPE_COMPLETED = 'news.article.scrape.completed',
  NEWS_ARTICLE_SCRAPE_FAILED = 'news.article.scrape.failed',
}

export type NewsMessageBrokerQueuesDataType = {
  [NewsMessageBrokerQueuesEnum.NEWS_RECENT_ARTICLES_SCRAPE]: {
    newsSite: string;
    url?: string;
  };
  [NewsMessageBrokerQueuesEnum.NEWS_RECENT_ARTICLES_SCRAPE_STARTED]: {
    newsSite: string;
    url?: string;
  };
  [NewsMessageBrokerQueuesEnum.NEWS_RECENT_ARTICLES_SCRAPE_COMPLETED]: {
    newsSite: string;
    url?: string;
  };
  [NewsMessageBrokerQueuesEnum.NEWS_RECENT_ARTICLES_SCRAPE_FAILED]: {
    newsSite: string;
    url?: string;
    errorMessage?: string;
  };
  [NewsMessageBrokerQueuesEnum.NEWS_ARTICLE_SCRAPE]: {
    url: string;
  };
  [NewsMessageBrokerQueuesEnum.NEWS_ARTICLE_SCRAPE_STARTED]: {
    url: string;
  };
  [NewsMessageBrokerQueuesEnum.NEWS_ARTICLE_SCRAPE_COMPLETED]: {
    url: string;
  };
  [NewsMessageBrokerQueuesEnum.NEWS_ARTICLE_SCRAPE_FAILED]: {
    url: string;
    errorMessage?: string;
  };
};
