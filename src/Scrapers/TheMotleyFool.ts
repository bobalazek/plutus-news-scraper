import { convert } from 'html-to-text';
import { NewsArticle, WithContext } from 'schema-dts';

import { NewsArticleDataNotFoundError } from '../Errors/NewsArticleDataNotFoundError';
import { NewsArticleType } from '../Schemas/NewsArticleSchema';
import { NewsBasicArticleType } from '../Schemas/NewsBasicArticleSchema';
import { NewsArticleMultimediaTypeEnum } from '../Types/NewsArticleMultimediaTypeEnum';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';
import { getNewsArticleLinkedData, getUniqueArray, sleep } from '../Utils/Helpers';
import { AbstractNewsScraper } from './AbstractNewsScraper';

export default class TheMotleyFoolNewsScraper extends AbstractNewsScraper implements NewsScraperInterface {
  key: string = 'the_motley_fool';
  domain: string = 'www.fool.com';
  recentArticleListUrls: string[] = ['https://www.fool.com/', 'https://www.fool.com/investing-news/'];

  useJSDOM: boolean = false;

  async scrapeRecentArticles(urls?: string[]): Promise<NewsBasicArticleType[]> {
    const basicArticles: NewsBasicArticleType[] = [];
    const recentArticleListUrls = Array.isArray(urls) ? urls : this.recentArticleListUrls;

    this._logger.info(`Starting to scrape the recent articles on The Motley Fool ...`);

    for (const recentArticleListUrl of recentArticleListUrls) {
      this._logger.info(`Going to URL ${recentArticleListUrl} ...`);

      await sleep(1000);
      await this.goToPage(recentArticleListUrl, {
        waitUntil: 'domcontentloaded',
      });

      const articleUrls = getUniqueArray(
        await this.evaluateInDocument((document) => {
          // Get all the possible (anchor) elements that have the links to articles
          const querySelector = ['#main-content article a', '.content-container div a'].join(', ');

          // Fetch those with the .querySelectoAll() and convert it to an array
          const $elements = Array.from(document.querySelectorAll(querySelector));

          // Loop/map through those elements and get the href artibute
          return $elements.map(($el) => {
            if ($el.querySelector('h3') === null && $el.querySelector('h5') === null) {
              return '';
            }

            return $el.getAttribute('href') ?? ''; // Needs to have a '' (empty string) as a fallback, because otherwise it could be null, which we don't want
          });
        })
      ).map((uri) => {
        return `https://www.fool.com${uri}`;
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

    const newsSiteArticleId = await this.evaluateInDocument((document) => {
      return document.querySelector('head meta[name="article_uuid"]')?.getAttribute('content') ?? '';
    });

    const categoryName = await this.evaluateInDocument((document) => {
      return document.querySelector('head meta[property="article:section"]')?.getAttribute('content') ?? '';
    });

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
      return Array.from(document.querySelectorAll('.content-container .tailwind-article-body'))
        .map((element) => {
          return element.innerHTML;
        })
        .join('');
    });

    const article: NewsArticleType = {
      ...getNewsArticleLinkedData(linkedData),
      url: url,
      newsSiteArticleId: newsSiteArticleId,
      multimediaType: NewsArticleMultimediaTypeEnum.TEXT,
      content: convert(content, {
        wordwrap: false,
      }),
      categories: [{ name: categoryName }],
      languageCode: languageCode,
    };

    return Promise.resolve(article);
  }

  private _preProcessUrl(url: string): string {
    const urlObject = new URL(url);

    return url.replace(urlObject.search, '').replace(urlObject.hash, '');
  }
}
