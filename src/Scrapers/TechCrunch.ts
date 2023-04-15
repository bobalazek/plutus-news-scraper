import { convert } from 'html-to-text';
import { NewsArticle, WithContext } from 'schema-dts';

import { NewsArticleDataNotFoundError } from '../Errors/NewsArticleDataNotFoundError';
import { NewsArticleType } from '../Schemas/NewsArticleSchema';
import { NewsBasicArticleType } from '../Schemas/NewsBasicArticleSchema';
import { NewsArticleMultimediaTypeEnum } from '../Types/NewsArticleMultimediaTypeEnum';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';
import { getNewsArticleLinkedData, getUniqueArray, sleep } from '../Utils/Helpers';
import { AbstractNewsScraper } from './AbstractNewsScraper';

export default class TechCrunchNewsScraper extends AbstractNewsScraper implements NewsScraperInterface {
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

  useJSDOM: boolean = false;

  async scrapeRecentArticles(urls?: string[]): Promise<NewsBasicArticleType[]> {
    const basicArticles: NewsBasicArticleType[] = [];
    const recentArticleListUrls = Array.isArray(urls) ? urls : this.recentArticleListUrls;

    this._logger.info(`Starting to scrape the recent articles on TechCrunch...`);

    for (const recentArticleListUrl of recentArticleListUrls) {
      this._logger.info(`Going to URL ${recentArticleListUrl} ...`);

      await sleep(1000);
      await this.goToPage(recentArticleListUrl, {
        waitUntil: 'domcontentloaded',
      });

      const $consentPageDiv = await this.evaluateInDocument((document) => {
        return document.querySelector('#consent-page');
      });
      if ($consentPageDiv) {
        await this.clickOnPage('#consent-page .actions button[value="agree"]');
        await this.goToPage(recentArticleListUrl, {
          waitUntil: 'domcontentloaded',
        });
      }

      const articleUrls = getUniqueArray(
        await this.evaluateInDocument((document) => {
          // Get all the possible (anchor) elements that have the links to articles
          const querySelector = ['.content a.post-block__title__link'].join(', ');

          // Fetch those with the .querySelectoAll() and convert it to an array
          const $elements = Array.from(document.querySelectorAll(querySelector));

          // Loop/map through those elements and get the href artibute
          return $elements.map(($el) => {
            return $el.getAttribute('href') ?? ''; // Needs to have a '' (empty string) as a fallback, because otherwise it could be null, which we don't want
          });
        })
      ).map((uri) => {
        return `https://techcrunch.com${uri}`;
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

    return Promise.resolve(getUniqueArray(basicArticles));
  }

  async scrapeArticle(basicArticle: NewsBasicArticleType): Promise<NewsArticleType> {
    const url = this._preProcessUrl(basicArticle.url);

    this._logger.info(`Going to URL ${url} ...`);

    await this.goToPage(url, {
      waitUntil: 'domcontentloaded',
    });

    const $consentPageDiv = await this.evaluateInDocument((document) => {
      return document.querySelector('#consent-page');
    });
    if ($consentPageDiv) {
      await this.clickOnPage('#consent-page .actions button[value="agree"]');
      await this.goToPage(url, {
        waitUntil: 'domcontentloaded',
      });
    }

    const shortlink = await this.evaluateInDocument((document) => {
      return document.querySelector('head link[rel="shortlink"]')?.getAttribute('href') ?? '';
    });

    const newsSiteArticleId = shortlink.replace('https://techcrunch.com/?p=', '');

    const linkedDataText = await this.evaluateInDocument((document) => {
      return document.querySelector('head script[type="application/ld+json"]')?.innerHTML ?? '';
    });
    if (!linkedDataText) {
      throw new NewsArticleDataNotFoundError(`Linked data not found for URL ${url}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawLinkedData = JSON.parse(linkedDataText) as any;
    const linkedData = rawLinkedData['@graph'][0] as WithContext<NewsArticle>;
    const authorLinkedData = rawLinkedData['@graph'][5];

    // Content
    await this.waitForSelectorOnPage('.article-content p');
    const content = await this.evaluateInDocument((document) => {
      return Array.from(document.querySelectorAll('.article-content p'))
        .map((element) => {
          return element.innerHTML;
        })
        .join('');
    });

    const article: NewsArticleType = {
      ...getNewsArticleLinkedData(linkedData),
      url: url,
      multimediaType: NewsArticleMultimediaTypeEnum.TEXT,
      content: convert(content, {
        wordwrap: false,
      }),
      newsSiteArticleId: newsSiteArticleId,
      authors: [authorLinkedData],
    };

    return Promise.resolve(article);
  }

  private _preProcessUrl(url: string): string {
    const urlObject = new URL(url);

    return url.replace(urlObject.search, '').replace(urlObject.hash, '');
  }
}
