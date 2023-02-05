import { convert } from 'html-to-text';

import { AbstractNewsScraper } from '../AbstractNewsScraper';
import { logger } from '../Services/Logger';
import { NewsArticleInterface } from '../Types/NewsArticleInterface';
import { NewsArticleMultimediaTypeEnum } from '../Types/NewsArticleMultimediaTypeEnum';
import { NewsBasicArticleInterface } from '../Types/NewsBasicArticleInterface';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';

export default class CNBCScraper extends AbstractNewsScraper implements NewsScraperInterface {
  key: string = 'cnbc';
  domain: string = 'www.cnbc.com';
  recentArticleListUrls: string[] = [
    'https://www.cnbc.com/business/',
    'https://www.cnbc.com/investing/',
    'https://www.cnbc.com/technology/',
    'https://www.cnbc.com/politics/',
    // 'https://www.cnbc.com/tv/',
  ];

  async scrapeRecentArticles(url?: string | string[]): Promise<NewsBasicArticleInterface[]> {
    const basicArticles: NewsBasicArticleInterface[] = [];
    const recentArticleListUrls = url ? [...url] : this.recentArticleListUrls;

    const page = await this.getPuppeteerPage();

    logger.info(`Starting to scrape the recent articles on CNBC ...`);

    for (const recentArticleListUrl of recentArticleListUrls) {
      logger.info(`Going to URL ${recentArticleListUrl} ...`);

      await page.goto(recentArticleListUrl, {
        waitUntil: 'domcontentloaded',
      });

      const articleUrls = this.getUniqueArray(
        await page.evaluate(() => {
          // Get all the possible (anchor) elements that have the links to articles
          const querySelector = ['.Card-textContent a.Card-title'].join(', ');

          // Fetch those with the .querySelectoAll() and convert it to an array
          const $elements = Array.from(document.querySelectorAll(querySelector));

          // Loop/map through those elements and get the href artibute
          return $elements.map(($el) => {
            return $el.getAttribute('href') ?? ''; // Needs to have a '' (empty string) as a fallback, because otherwise it could be null, which we don't want
          });
        })
      ).filter((href) => {
        return href !== ''; // Now we want to filter out any links that are '', just in case
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

    const newsSiteArticleId = await page.evaluate(() => {
      return document.querySelector('head meta[property="pageNodeId"]')?.getAttribute('content') ?? '';
    });
    const datePublished = await page.evaluate(() => {
      return document.querySelector('head meta[itemprop="dateCreated"]')?.getAttribute('content') ?? '';
    });
    const dateModified = await page.evaluate(() => {
      return document.querySelector('head meta[itemprop="dateModified"]')?.getAttribute('content') ?? '';
    });
    const title = await page.evaluate(() => {
      return document.querySelector('head meta[property="og:title"]')?.getAttribute('content') ?? '';
    });

    // Content
    const content = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.PageBuilder-article .ArticleBody-articleBody'))
        .map((element) => {
          return element.innerHTML;
        })
        .join('');
    });

    await this.closePuppeteerBrowser();

    const article: NewsArticleInterface = {
      url: url,
      title: title,
      multimediaType: NewsArticleMultimediaTypeEnum.TEXT,
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
