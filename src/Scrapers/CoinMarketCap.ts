import { convert } from 'html-to-text';

import { NewsArticleType } from '../Schemas/NewsArticleSchema';
import { NewsBasicArticleType } from '../Schemas/NewsBasicArticleSchema';
import { NewsArticleMultimediaTypeEnum } from '../Types/NewsArticleMultimediaTypeEnum';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';
import { AbstractNewsScraper } from './AbstractNewsScraper';

export default class CoinMarketCapNewsScraper extends AbstractNewsScraper implements NewsScraperInterface {
  key: string = 'coinmarketcap';
  domain: string = 'coinmarketcap.com';
  recentArticleListUrls: string[] = [
    'https://coinmarketcap.com/community/articles/browse/?sort=-publishedOn&page=1&category=',
  ];

  async scrapeRecentArticles(urls?: string[]): Promise<NewsBasicArticleType[]> {
    const basicArticles: NewsBasicArticleType[] = [];
    const recentArticleListUrls = Array.isArray(urls) ? urls : this.recentArticleListUrls;

    const page = await this.getPuppeteerPage();

    this._logger.info(`Starting to scrape the recent articles on CoinMarketCap ...`);

    for (const recentArticleListUrl of recentArticleListUrls) {
      this._logger.info(`Going to URL ${recentArticleListUrl} ...`);

      await page.waitForTimeout(1000);
      await page.goto(recentArticleListUrl, {
        waitUntil: 'networkidle0',
      });

      const articleUrls = this.getUniqueArray(
        await page.evaluate(() => {
          // Get all the possible (anchor) elements that have the links to articles
          const querySelector = ['#__next .hero main a[href^="/community/articles/"]'].join(', ');

          // Fetch those with the .querySelectoAll() and convert it to an array
          const $elements = Array.from(document.querySelectorAll(querySelector));

          // Loop/map through those elements and get the href artibute
          return $elements.map(($el) => {
            return $el.getAttribute('href') ?? ''; // Needs to have a '' (empty string) as a fallback, because otherwise it could be null, which we don't want
          });
        })
      )
        .filter((href) => {
          return href !== '' && !href.includes('/browse/') && !href.endsWith('/articles/');
        })
        .map((uri) => {
          return `https://coinmarketcap.com${uri}`;
        });

      this._logger.info(`Found ${articleUrls.length} articles on this page`);

      for (const articleUrl of articleUrls) {
        const url = this._preProcessUrl(articleUrl);

        this._logger.debug(`Article URL: ${url}`);

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
    const url = this._preProcessUrl(basicArticle.url);

    this._logger.info(`Going to URL ${url} ...`);

    const page = await this.getPuppeteerPage();
    await page.goto(url, {
      waitUntil: 'networkidle2',
    });

    const urlSplit = url.split('/');
    const urlId = urlSplit[urlSplit.length - 2];
    const newsSiteArticleId = urlId;

    const headline = await page.evaluate(() => {
      return document.querySelector('head meta[property="og:title"]')?.getAttribute('content') ?? '';
    });

    const datePublished = await page.evaluate(() => {
      return document.querySelector('body')?.getAttribute('data-commit-time') ?? '';
    });

    const dateModified = await page.evaluate(() => {
      return document.querySelector('body')?.getAttribute('data-commit-time') ?? '';
    });

    const authors = await page.evaluate(() => {
      return Array.from(document.querySelectorAll(['body a > a.name'].join(', '))).map(($a) => {
        return {
          name: $a.innerHTML ?? '',
          url: $a.getAttribute('href') ? 'https://coinmarketcap.com' + $a.getAttribute('href') : undefined,
        };
      });
    });

    const imageUrl = await page.evaluate(() => {
      return document.querySelector('head meta[property="og:image"]')?.getAttribute('content') ?? '';
    });

    const languageCode = await page.evaluate(() => {
      return document.querySelector('html')?.getAttribute('lang') ?? '';
    });

    // Content
    const content = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('#__next article'))
        .map((element) => {
          return element.innerHTML;
        })
        .join('');
    });

    const article: NewsArticleType = {
      url: url,
      title: headline,
      multimediaType: NewsArticleMultimediaTypeEnum.TEXT,
      content: convert(content, {
        wordwrap: false,
      }),
      newsSiteArticleId: newsSiteArticleId,
      publishedAt: new Date(datePublished),
      modifiedAt: new Date(dateModified),
      authors: authors,
      imageUrl: imageUrl,
      languageCode: languageCode,
    };

    return Promise.resolve(article);
  }

  private _preProcessUrl(url: string): string {
    const urlObject = new URL(url);

    return url.replace(urlObject.search, '').replace(urlObject.hash, '');
  }
}
