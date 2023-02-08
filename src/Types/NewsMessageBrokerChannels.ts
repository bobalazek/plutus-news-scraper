export enum NewsMessageBrokerChannelsEnum {
  NEWS_RECENT_ARTICLES_SCRAPE = 'news.recent_articles.scrape',
  NEWS_ARTICLE_SCRAPE = 'news.article.scrape',
}

export type NewsMessageBrokerChannelsDataType = {
  [NewsMessageBrokerChannelsEnum.NEWS_RECENT_ARTICLES_SCRAPE]: {
    newsSite: string;
    url?: string;
  };
  [NewsMessageBrokerChannelsEnum.NEWS_ARTICLE_SCRAPE]: {
    url: string;
  };
};
