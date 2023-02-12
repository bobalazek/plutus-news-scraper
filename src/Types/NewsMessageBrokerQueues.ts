export enum NewsMessageBrokerQueuesEnum {
  NEWS_RECENT_ARTICLES_SCRAPE = 'news.recent_articles.scrape',
  NEWS_ARTICLE_SCRAPE = 'news.article.scrape',
}

export type NewsMessageBrokerQueuesDataType = {
  [NewsMessageBrokerQueuesEnum.NEWS_RECENT_ARTICLES_SCRAPE]: {
    newsSite: string;
    url?: string;
  };
  [NewsMessageBrokerQueuesEnum.NEWS_ARTICLE_SCRAPE]: {
    url: string;
  };
};
