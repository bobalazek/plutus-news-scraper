import { convert } from 'html-to-text';

import { AbstractNewsScraper } from '../AbstractNewsScraper';
import { NewsArticleDataNotFoundError } from '../Errors/NewsArticleDataNotFoundError';
import { logger } from '../Services/Logger';
import { NewsArticleInterface } from '../Types/NewsArticleInterface';
import { NewsArticleMultimediaTypeEnum } from '../Types/NewsArticleMultimediaTypeEnum';
import { NewsBasicArticleInterface } from '../Types/NewsBasicArticleInterface';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';

export default class TechCrunchScraper extends AbstractNewsScraper implements NewsScraperInterface {
  key: string = 'techcrunch';
  domain: string = 'techcrunch.com';
  recentArticleListUrls: string[] = [
    'https://techcrunch.com/',
    'https://techcrunch.com/category/startups/',
    'https://techcrunch.com/category/venture/',
    'https://techcrunch.com/category/security/',
    'https://techcrunch.com/category/cryptocurrency/',
    'https://techcrunch.com/category/apps/',
  ];

  async scrapeRecentArticles(urls?: string[]): Promise<NewsBasicArticleInterface[]> {
    const basicArticles: NewsBasicArticleInterface[] = [];
    const recentArticleListUrls = Array.isArray(urls) ? urls : this.recentArticleListUrls;

    const page = await this.getPuppeteerPage();

    logger.info(`Starting to scrape the recent articles on TechCrunch...`);

    for (const recentArticleListUrl of recentArticleListUrls) {
      logger.info(`Going to URL ${recentArticleListUrl} ...`);

      await page.goto(recentArticleListUrl, {
        waitUntil: 'domcontentloaded',
      });

      const $consentPageDiv = await page.evaluate(() => {
        return document.querySelector('#consent-page');
      });
      if ($consentPageDiv) {
        await page.click('#consent-page .actions button[value="agree"]');

        await page.goto(recentArticleListUrl, {
          waitUntil: 'domcontentloaded',
        });
      }

      const articleUrls = this.getUniqueArray(
        await page.evaluate(() => {
          // Get all the possible (anchor) elements that have the links to articles
          const querySelector = ['.content a.post-block__title__link'].join(', ');

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
          return `https://techcrunch.com${uri}`;
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

    const $consentPageDiv = await page.evaluate(() => {
      return document.querySelector('#consent-page');
    });
    if ($consentPageDiv) {
      await page.click('#consent-page .actions button[value="agree"]');

      await page.goto(url, {
        waitUntil: 'domcontentloaded',
      });
    }

    const shortlink = await page.evaluate(() => {
      return document.querySelector('head link[rel="shortlink"]')?.getAttribute('href') ?? '';
    });

    const newsSiteArticleId = shortlink.replace('https://techcrunch.com/?p=', '');

    const linkedDataText = await page.evaluate(() => {
      return document.querySelector('head script[type="application/ld+json"]')?.innerHTML ?? '';
    });
    if (!linkedDataText) {
      throw new NewsArticleDataNotFoundError(`No linked data found for URL ${url}`);
    }

    const linkedData = JSON.parse(linkedDataText);

    // Content
    await page.waitForSelector('.article-content p');
    const content = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.article-content p'))
        .map((element) => {
          return element.innerHTML;
        })
        .join('');
    });

    await this.closePuppeteerBrowser();

    const article: NewsArticleInterface = {
      url: url,
      title: linkedData.headline,
      multimediaType: NewsArticleMultimediaTypeEnum.TEXT,
      content: convert(content, {
        wordwrap: false,
      }),
      newsSiteArticleId: newsSiteArticleId,
      publishedAt: new Date(linkedData['@graph'][0].datePublished),
      modifiedAt: new Date(linkedData['@graph'][0].dateModified),
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
