import { NewsArticleTypeEnum } from './Enums';

/**
 * Use this to return the very basic data from the news list pages.
 * The only required propery is the url, but you can also add the title or content if you want.
 */
export interface NewsBasicArticleInterface {
  url: string;
  title?: string;
  content?: string;
}

/**
 * This is just the same basic article as above, but it also includes the newsSiteKey.
 */
export interface NewsBasicArticleWithSiteKeyInterface extends NewsBasicArticleInterface {
  newsSiteKey: string;
}

/**
 * This is the interface for our news scraper.
 */
export interface NewsArticleInterface extends NewsBasicArticleInterface {
  title: string;
  type: NewsArticleTypeEnum;
  content: string;
  newsSiteArticleId: string;
  assets?: NewsArticleAssetInterface[];
  authorName?: string;
  authorUrl?: string;
  categoryName?: string;
  categoryUrl?: string;
  imageUrl?: string;
  tags?: string[];
  localeCode?: string;
  publishedAt: Date;
  modifiedAt: Date;
}

/**
 * This interface would mostly be used when we are persisting that data somewhere like
 * into a file or into the database.
 */
export interface NewsArticleWithSiteKeyInterface extends NewsArticleInterface {
  newsSiteKey: string;
}

export interface NewsArticleAssetInterface {
  name: string;
  symbol: string;
  sentimentScore: number; // -1 for very negative, 0 for neutral and 1 for very positive
}

export interface NewsScraperGetArchivedArticlesOptionsInterface {
  from?: Date;
  to?: Date;
}

export interface NewsScraperInterface {
  /**
   * The key which will be added into the database for the scraper.
   * It's also the key that you will need to use when triggering the scaping command like:
   * yarn cli recent-articles:scrape --news-site {key}
   */
  key: string;

  /**
   * On which domain are the articles?
   */
  domain: string;

  /**
   * What alternative domains are the articles on?
   */
  domainAliases?: string[];

  /**
   * With this method we are just scraping the landing and category pages,
   * so we can at least get the url for that article (but can also optionally provide the title and content),
   * which is then later used in the scrapeArticle method, where we scrape the actual page url
   * and get all the data we really need.
   */
  scrapeRecentArticles(): Promise<NewsBasicArticleInterface[]>;

  /**
   * Scrape the article by providing the partial article object (can only be a URL)
   *
   * @param article NewsScraperPartialArticleInterface
   */
  scrapeArticle(article: NewsBasicArticleInterface): Promise<NewsArticleInterface | null>;

  /**
   * Getting all the old and archived articles for that news site.
   * Most likely we will need do inspect the request on the site and do direct API requests
   * and get the data from that, instead of actually scraping it.
   *
   * @param options NewsScraperGetArchivedArticlesOptionsInterface
   */
  scrapeArchivedArticles?(
    options: NewsScraperGetArchivedArticlesOptionsInterface
  ): Promise<NewsBasicArticleInterface[]>;
}
