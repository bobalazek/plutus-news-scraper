import { convert } from 'html-to-text';

import { AbstractNewsScraper } from '../AbstractNewsScraper';
import { logger } from '../Services/Logger';
import { NewsArticleInterface } from '../Types/NewsArticleInterface';
import { NewsArticleTypeEnum } from '../Types/NewsArticleTypeEnum';
import { NewsBasicArticleInterface } from '../Types/NewsBasicArticleInterface';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';

export default class ForbesScraper extends AbstractNewsScraper implements NewsScraperInterface {
  key: string = 'forbes';
  domain: string = 'www.forbes.com';

  async scrapeRecentArticles(): Promise<NewsBasicArticleInterface[]> {
    const basicArticles: NewsBasicArticleInterface[] = []; // Initialise an empty array, where we can save the article data (mainly the URL)
    const recentArticleListUrls = [
      // Add all the page/category URLs that you want to scrape, so you get the actual article URLS
      'https://www.forbes.com/innovation',
      'https://www.forbes.com/money',
      'https://www.forbes.com/business',
      'https://www.forbes.com/real-estate',
    ];

    const page = await this.getPuppeteerPage();

    logger.info(`Starting to scrape the recent articles on Forbes ...`);

    for (const recentArticleListUrl of recentArticleListUrls) {
      logger.info(`Going to URL ${recentArticleListUrl} ...`);

      await page.goto(recentArticleListUrl, {
        waitUntil: 'domcontentloaded',
      });

      const articleUrls = this.getUniqueArray(
        await page.evaluate(() => {
          // Get all the possible (anchor) elements that have the links to articles
          const querySelector = ['.channel__content .card a', '.chansec-stream__list a.stream-item__title'].join(', ');

          // Fetch those with the .querySelectoAll() and convert it to an array
          const $elements = Array.from(document.querySelectorAll(querySelector));

          // Loop/map through those elements and get the href artibute
          return $elements.map(($el) => {
            return $el.getAttribute('href') ?? ''; // Needs to have a '' (empty string) as a fallback, because otherwise it could be null, which we don't want
          });
        })
      )
        .filter((href) => {
          return href !== ''; // Now we want to filter out any links that are '', just in case
        })
        .map((uri) => {
          return `https://www.forbes.com${uri}`;
        });

      logger.info(`Found ${articleUrls.length} articles on this page`);

      for (const articleUrl of articleUrls) {
        const url = this._preProcessUrl(articleUrl);

        logger.debug(`Article URL: ${url}`);

        basicArticles.push({
          // We are actually pushing a basic article object, instead of just URL,
          // if in the future we for example maybe want to provide some more metadata
          // on the list (recent  and archived articles) scrape
          url: url,
        });
      }
    }

    await this.closePuppeteerBrowser();

    return Promise.resolve(this.getUniqueArray(basicArticles));
  }

  async scrapeArticle(basicArticle: NewsBasicArticleInterface): Promise<NewsArticleInterface | null> {
    const page = await this.getPuppeteerPage();

    const url = this._preProcessUrl(basicArticle.url);

    logger.info(`Going to URL ${url} ...`);

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
    });

    const newsSiteArticleId = url;

    const linkedDataText = await page.evaluate(() => {
      return document.querySelector('head script[type="application/ld+json"]')?.innerHTML ?? '';
    });
    if (!linkedDataText) {
      throw new Error(`No linked data found for URL ${url}`);
    }

    const linkedData = JSON.parse(linkedDataText);

    // Content
    const content = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('article .body-content p'))
        .map((element) => {
          return element.innerHTML;
        })
        .join('');
    });

    await this.closePuppeteerBrowser();

    const article: NewsArticleInterface = {
      url: url,
      title: linkedData.headline,
      type: NewsArticleTypeEnum.TEXT,
      content: convert(content, {
        wordwrap: false,
      }),
      newsSiteArticleId: newsSiteArticleId,
      publishedAt: new Date(linkedData.datePublished),
      modifiedAt: new Date(linkedData.dateModified),
    };

    logger.debug(`Article data:`);
    logger.debug(article);

    return Promise.resolve(article);
  }

  private _preProcessUrl(url: string): string {
    const urlObject = new URL(url);

    return url.replace(urlObject.search, '').replace(urlObject.hash, '');
  }
}
