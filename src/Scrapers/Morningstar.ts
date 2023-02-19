import { convert } from 'html-to-text';

import { NewsArticleType } from '../Schemas/NewsArticleSchema';
import { NewsBasicArticleType } from '../Schemas/NewsBasicArticleSchema';
import { logger } from '../Services/Logger';
import { NewsArticleMultimediaTypeEnum } from '../Types/NewsArticleMultimediaTypeEnum';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';
import { AbstractNewsScraper } from './AbstractNewsScraper';

export default class MorningstarNewsScraper extends AbstractNewsScraper implements NewsScraperInterface {
  key: string = 'morningstar';
  domain: string = 'www.morningstar.com';
  recentArticleListUrls: string[] = [
    'https://www.morningstar.com/market-moments/coronavirus-economic-impact',
    'https://www.morningstar.com/topics/sustainable-investing',
    'https://www.morningstar.com/funds',
    'https://www.morningstar.com/etfs',
    'https://www.morningstar.com/stocks',
    'https://www.morningstar.com/bonds',
    'https://www.morningstar.com/markets',
  ];

  async scrapeRecentArticles(urls?: string[]): Promise<NewsBasicArticleType[]> {
    const basicArticles: NewsBasicArticleType[] = [];
    const recentArticleListUrls = Array.isArray(urls) ? urls : this.recentArticleListUrls;

    const page = await this.getPuppeteerPage();

    logger.info(`Starting to scrape the recent articles on Morningstar ...`);

    for (const recentArticleListUrl of recentArticleListUrls) {
      logger.info(`Going to URL ${recentArticleListUrl} ...`);

      await page.waitForTimeout(1000);
      await page.goto(recentArticleListUrl, {
        waitUntil: 'domcontentloaded',
      });

      const articleUrls = this.getUniqueArray(
        await page.evaluate(() => {
          // Get all the possible (anchor) elements that have the links to articles
          const querySelector = [
            '.market-moment .mdc-carousel-item a.mdc-link',
            '.mdc-grid-item__content a.mdc-link',
          ].join(', ');

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
          return `https://www.morningstar.com${uri}`;
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

    return Promise.resolve(this.getUniqueArray(basicArticles));
  }

  async scrapeArticle(basicArticle: NewsBasicArticleType): Promise<NewsArticleType> {
    const page = await this.getPuppeteerPage();

    const url = this._preProcessUrl(basicArticle.url);

    logger.info(`Going to URL ${url} ...`);

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
    });

    const urlSplit = url.split('/');
    const urlId = urlSplit[urlSplit.length - 2];
    const newsSiteArticleId = urlId;

    const title = await page.evaluate(() => {
      return document.querySelector('head meta[property="og:title"]')?.getAttribute('content') ?? '';
    });
    const datePublished = await page.evaluate(() => {
      return document.querySelector('head meta[property="og:article:published_time"]')?.getAttribute('content') ?? '';
    });
    const dateModified = await page.evaluate(() => {
      return document.querySelector('head meta[property="og:article:modified_time"]')?.getAttribute('content') ?? '';
    });
    const authorName = await page.evaluate(() => {
      return (
        document
          .querySelector('.article__article-info .article__author meta[itemprop="name"]')
          ?.getAttribute('content') ?? ''
      );
    });

    const authorLink = await page.evaluate(() => {
      return document.querySelector('.article__article-info .article__author a')?.getAttribute('href') ?? '';
    });

    const authorUrl = 'https://www.morningstar.com/' + authorLink;

    const categoryName = await page.evaluate(() => {
      return document.querySelector('head meta[property="og:article:section"]')?.getAttribute('content') ?? '';
    });

    const categoryLink = await page.evaluate(() => {
      return document.querySelector('.article__container a')?.getAttribute('href') ?? '';
    });

    const categoryUrl = 'https://www.morningstar.com/' + categoryLink;

    const imageUrl = await page.evaluate(() => {
      return document.querySelector('head meta[property="og:image"]')?.getAttribute('content') ?? '';
    });

    // Content
    const content = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.article__container .article__body'))
        .map((element) => {
          return element.innerHTML;
        })
        .join('');
    });

    const article: NewsArticleType = {
      url: url,
      title: title,
      multimediaType: NewsArticleMultimediaTypeEnum.TEXT,
      content: convert(content, {
        wordwrap: false,
      }),
      newsSiteArticleId: newsSiteArticleId,
      publishedAt: new Date(datePublished),
      modifiedAt: new Date(dateModified),
      authors: [{ name: authorName, url: authorUrl }],
      categories: [{ name: categoryName, url: categoryUrl }],
      imageUrl: imageUrl,
    };

    return Promise.resolve(article);
  }

  private _preProcessUrl(url: string): string {
    const urlObject = new URL(url);

    return url.replace(urlObject.search, '').replace(urlObject.hash, '');
  }
}
