import { convert } from 'html-to-text';
import { NewsArticle, WithContext } from 'schema-dts';

import { NewsArticleDataNotFoundError } from '../Errors/NewsArticleDataNotFoundError';
import { NewsArticleType } from '../Schemas/NewsArticleSchema';
import { NewsBasicArticleType } from '../Schemas/NewsBasicArticleSchema';
import { NewsArticleMultimediaTypeEnum } from '../Types/NewsArticleMultimediaTypeEnum';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';
import { getNewsArticleLinkedData, getUniqueArray, sleep } from '../Utils/Helpers';
import { AbstractNewsScraper } from './AbstractNewsScraper';

export default class TheWallStreetJournalNewsScraper extends AbstractNewsScraper implements NewsScraperInterface {
  key: string = 'wsj';
  domain: string = 'www.wsj.com';
  recentArticleListUrls: string[] = [
    'https://www.wsj.com/news/world',
    'https://www.wsj.com/news/us',
    'https://www.wsj.com/news/politics',
    'https://www.wsj.com/news/economy',
    'https://www.wsj.com/news/business',
    'https://www.wsj.com/news/technology',
    'https://www.wsj.com/news/markets',
    'https://www.wsj.com/news/opinion',
    'https://www.wsj.com/news/books-arts',
    'https://www.wsj.com/news/realestate',
  ];

  useJSDOM: boolean = true;

  async scrapeRecentArticles(urls?: string[]): Promise<NewsBasicArticleType[]> {
    const basicArticles: NewsBasicArticleType[] = [];
    const recentArticleListUrls = Array.isArray(urls) ? urls : this.recentArticleListUrls;

    this._logger.info(`Starting to scrape the recent articles on The Wall Street Journal ...`);

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
            '#top-news div[class^="WSJTheme--headline--"] a',
            'article div[class^="WSJTheme--headline--"] a',
          ].join(', ');

          // Fetch those with the .querySelectoAll() and convert it to an array
          const $elements = Array.from(document.querySelectorAll(querySelector));

          // Loop/map through those elements and get the href artibute
          return $elements.map(($el) => {
            return $el.getAttribute('href') ?? ''; // Needs to have a '' (empty string) as a fallback, because otherwise it could be null, which we don't want
          });
        })
      );

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

    const urlSplit = url.split('/');
    const slug = urlSplit[urlSplit.length - 1];
    const slugSplit = slug.split('-');

    const newsSiteArticleId = slugSplit[slugSplit.length - 1];

    const categories = await this.evaluateInDocument((document) => {
      return Array.from(
        document.querySelectorAll(['.article_header .category li.article-breadCrumb a'].join(', '))
      ).map(($a) => {
        return {
          name: ($a.innerHTML ?? '').trim(),
          url: $a.getAttribute('href') ?? undefined,
        };
      });
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawLinkedData = JSON.parse(linkedDataText) as any;
    const linkedData = rawLinkedData[0] as WithContext<NewsArticle>;

    // Content
    const content = await this.evaluateInDocument((document) => {
      return Array.from(document.querySelectorAll('#main .wsj-snippet-body p'))
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
      categories: categories,
      languageCode: languageCode,
    };

    return Promise.resolve(article);
  }

  private _preProcessUrl(url: string): string {
    const urlObject = new URL(url);

    return url.replace(urlObject.search, '').replace(urlObject.hash, '');
  }
}
