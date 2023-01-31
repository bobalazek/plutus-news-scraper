import { convert } from 'html-to-text';

import { AbstractNewsScraper } from '../AbstractNewsScraper';
import { logger } from '../Services/Logger';
import { NewsArticleTypeEnum } from '../Types/Enums';
import { NewsArticleInterface, NewsBasicArticleInterface, NewsScraperInterface } from '../Types/Interfaces';

export default class HindenburgResearchScraper extends AbstractNewsScraper implements NewsScraperInterface {
  key: string = 'hindenburg_research';
  domain: string = 'hindenburgresearch.com';
  domainAliases: string[] = ['www.hindenburgresearch.com'];

  async scrapeRecentArticles(): Promise<NewsBasicArticleInterface[]> {
    const basicArticles: NewsBasicArticleInterface[] = []; // Initialise an empty array, where we can save the article data (mainly the URL)
    const recentArticleListUrls = [
      // Add all the page/category URLs that you want to scrape, so you get the actual article URLS
      'https://hindenburgresearch.com/',
    ];

    const page = await this.getPuppeteerPage();

    logger.info(`Starting to scrape the recent articles on Hindenburg Research ...`);

    for (const recentArticleListUrl of recentArticleListUrls) {
      logger.info(`Going to URL ${recentArticleListUrl} ...`);

      await page.goto(recentArticleListUrl, {
        waitUntil: 'domcontentloaded',
      });

      const articleUrls = this.getUniqueArray(
        await page.evaluate(() => {
          // Get all the possible (anchor) elements that have the links to articles
          const querySelector = ['.post-preview'].join(', ');

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
          return `https://www.hindenburgresearch.com${uri}`;
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

    const jsonHref = await page.evaluate(() => {
      return (
        document
          .querySelector(
            'head link[type="application/json"][href^="https://hindenburgresearch.com/wp-json/wp/v2/posts/"]'
          )
          ?.getAttribute('href') ?? ''
      );
    });

    const jsonHrefSplit = jsonHref.split('/');
    const jsonHrefId = jsonHrefSplit[jsonHrefSplit.length - 1];

    const newsSiteArticleId = jsonHrefId;

    const datePublished = await page.evaluate(() => {
      return document.querySelector('head meta[property="article:published_time"]')?.getAttribute('content') ?? '';
    });
    const dateModified = await page.evaluate(() => {
      return document.querySelector('head meta[property="article:modified_time"]')?.getAttribute('content') ?? '';
    });
    const title = await page.evaluate(() => {
      return document.querySelector('head meta[property="og:title"]')?.getAttribute('content') ?? '';
    });

    // Content
    const content = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.container ul'))
        .map((element) => {
          return element.innerHTML;
        })
        .join('');
    });

    await this.closePuppeteerBrowser();

    const article: NewsArticleInterface = {
      url: url,
      title: title,
      type: NewsArticleTypeEnum.TEXT,
      content: convert(content, {
        wordwrap: false,
      }),
      newsSiteArticleId: newsSiteArticleId,
      publishedAt: new Date(datePublished),
      modifiedAt: new Date(dateModified),
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
