//TODO - This scraper doesn't work - Press and hold button when you come to the site
import { convert } from 'html-to-text';
import { NewsArticle, WithContext } from 'schema-dts';

import { NewsArticleDataNotFoundError } from '../Errors/NewsArticleDataNotFoundError';
import { NewsArticleType } from '../Schemas/NewsArticleSchema';
import { NewsBasicArticleType } from '../Schemas/NewsBasicArticleSchema';
import { NewsArticleMultimediaTypeEnum } from '../Types/NewsArticleMultimediaTypeEnum';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';
import { getNewsArticleLinkedData, getUniqueArray, sleep } from '../Utils/Helpers';
import { AbstractNewsScraper } from './AbstractNewsScraper';

export default class BloombergNewsScraper extends AbstractNewsScraper implements NewsScraperInterface {
  key: string = 'bloomberg';
  domain: string = 'www.bloomberg.com';
  recentArticleListUrls: string[] = [
    'https://www.bloomberg.com/',
    'https://www.bloomberg.com/europe',
    'https://www.bloomberg.com/uk',
    'https://www.bloomberg.com/asia',
    'https://www.bloomberg.com/middleeast',
    'https://www.bloomberg.com/africa',
    'https://www.bloomberg.com/markets',
    'https://www.bloomberg.com/economics',
    'https://www.bloomberg.com/industries',
    'https://www.bloomberg.com/technology',
    'https://www.bloomberg.com/politics',
    'https://www.bloomberg.com/wealth',
    'https://www.bloomberg.com/pursuits',
    'https://www.bloomberg.com/green',
    'https://www.bloomberg.com/crypto',
  ];

  useJSDOM: boolean = true;

  async scrapeRecentArticles(urls?: string[]): Promise<NewsBasicArticleType[]> {
    const basicArticles: NewsBasicArticleType[] = [];
    const recentArticleListUrls = Array.isArray(urls) ? urls : this.recentArticleListUrls;

    this._logger.info(`Starting to scrape the recent articles on Bloomberg ...`);

    for (const recentArticleListUrl of recentArticleListUrls) {
      this._logger.info(`Going to URL ${recentArticleListUrl} ...`);

      await sleep(1000);
      await this.goToPage(recentArticleListUrl, {
        waitUntil: 'domcontentloaded',
      });

      const articleUrls = getUniqueArray(
        await this.evaluateInDocument((document) => {
          // Get all the possible (anchor) elements that have the links to articles
          const querySelector = [
            '.single-story-module article .single-story-module__info a.single-story-module__headline-link',
            '.story-list-module .story-list-story .story-list-story__info__headline a.story-list-story__info__headline-link',
            '.hub-zone-switch__content .story-package-module__story a.story-package-module__story__headline-link',
          ].join(', ');

          // Fetch those with the .querySelectoAll() and convert it to an array
          const $elements = Array.from(document.querySelectorAll(querySelector));

          // Loop/map through those elements and get the href artibute
          return $elements.map(($el) => {
            return $el.getAttribute('href') ?? ''; // Needs to have a '' (empty string) as a fallback, because otherwise it could be null, which we don't want
          });
        })
      ).map((uri) => {
        return `https://www.bloomberg.com${uri}`;
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

    const newsSiteArticleId = url;

    const languageCode = await this.evaluateInDocument((document) => {
      return document.querySelector('html')?.getAttribute('lang') ?? '';
    });

    const linkedDataText = await this.evaluateInDocument((document) => {
      return document.querySelector('head script[type="application/ld+json"]')?.innerHTML ?? '';
    });
    if (!linkedDataText) {
      throw new NewsArticleDataNotFoundError(`Linked data not found for URL ${url}`);
    }

    const linkedData = JSON.parse(linkedDataText) as WithContext<NewsArticle>;

    // Content
    const content = await this.evaluateInDocument((document) => {
      return Array.from(document.querySelectorAll('article .body-content p'))
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
      languageCode: languageCode,
    };

    return Promise.resolve(article);
  }

  private _preProcessUrl(url: string): string {
    const urlObject = new URL(url);

    return url.replace(urlObject.search, '').replace(urlObject.hash, '');
  }
}
