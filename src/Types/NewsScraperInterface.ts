import { NewsArticleInterface } from './NewsArticleInterface';
import { NewsBasicArticleInterface } from './NewsBasicArticleInterface';
import { NewsScraperGetArchivedArticlesOptionsInterface } from './NewsScraperGetArchivedArticlesOptionsInterface';

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
