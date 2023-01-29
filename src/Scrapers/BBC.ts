import { AbstractNewsScraper } from '../AbstractNewsScraper';
import { logger } from '../Logger';
import { NewsArticleInterface, NewsBasicArticleInterface, NewsScraperInterface } from '../Types/Interfaces';

export default class BBCScraper extends AbstractNewsScraper implements NewsScraperInterface {
  key: string = 'bbc';
  domain: string = 'bbc.com';

  async scrapeRecentArticles(): Promise<NewsBasicArticleInterface[]> {
    const basicArticles: NewsBasicArticleInterface[] = []; // Initialise an empty array, where we can save the article data (mainly the URL)
    const recentArticleListUrls = [
      // Add all the page/category URLs that you want to scrape, so you get the actual article URLS
      'https://www.bbc.com/news',
      /* 'https://www.bbc.com/news/coronavirus',
      'https://www.bbc.com/news/world',
      'https://www.bbc.com/news/uk', */
    ];

    const browser = await this.getPuppeteerBrowser({
      headless: false,
    });
    const page = await browser.newPage();

    logger.info(`Starting to scrape the recent articles on BBC ...`);

    for (const recentArticleListUrl of recentArticleListUrls) {
      logger.info(`Going to URL ${recentArticleListUrl} ...`);

      await page.goto(recentArticleListUrl, {
        waitUntil: 'domcontentloaded',
      });

      const articleUrls = await page.evaluate(() => {
        // Get all the possible (anchor) elements that have the links to articles
        const querySelector = [
          '#news-top-stories-container a.gs-c-promo-heading',
          /* '.nw-c-seven-slice .gs-c-promo a',
          'lx-stream ol li a',
          'div[role="region"] a', */
        ].join(', ');

        // Fetch those with the .querySelectoAll() and convert it to an array
        const $elements = Array.from(document.querySelectorAll(querySelector));

        // Loop/map through those elements and get the href artibute
        return $elements
          .map(($el) => {
            return $el.getAttribute('href') ?? ''; // Needs to have a '' (empty string) as a fallback, because otherwise it could be null, which we don't want
          })
          .filter((href) => {
            return href !== ''; // Now we want to filter out any links that are '', just in case
          })
          .map((uri) => {
            return `https://www.bbc.com${uri}`;
          })
          .filter((url, index, array) => array.indexOf(url) === index); // Remove duplicates from the array
      });

      logger.info(`Found ${articleUrls.length} articles on this page`);

      for (const articleUrl of articleUrls) {
        logger.debug(`Article URL: ${articleUrl}`);

        basicArticles.push({
          // We are actually pushing a basic article object, instead of just URL,
          // if in the future we for example maybe want to provide some more metadata
          // on the list (recent and archived articles) scrape
          url: articleUrl,
        });
      }
    }

    browser.close();

    return Promise.resolve(basicArticles);
  }

  async scrapeArticle(basicArticle: NewsBasicArticleInterface): Promise<NewsArticleInterface | null> {
    const browser = this.getPuppeteerBrowser();

    return Promise.resolve(null);
  }
}
