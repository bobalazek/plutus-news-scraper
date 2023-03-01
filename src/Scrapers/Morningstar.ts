import { convert } from 'html-to-text';

import { NewsArticleType } from '../Schemas/NewsArticleSchema';
import { NewsBasicArticleType } from '../Schemas/NewsBasicArticleSchema';
import { NewsArticleMultimediaTypeEnum } from '../Types/NewsArticleMultimediaTypeEnum';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';
import { getUniqueArray, sleep } from '../Utils/Helpers';
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

    this._logger.info(`Starting to scrape the recent articles on Morningstar ...`);

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
      ).map((uri) => {
        return `https://www.morningstar.com${uri}`;
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
      waitUntil: 'networkidle2',
    });

    const urlSplit = url.split('/');
    const urlId = urlSplit[urlSplit.length - 2];
    const newsSiteArticleId = urlId;

    const title = await this.evaluateInDocument((document) => {
      return document.querySelector('head meta[property="og:title"]')?.getAttribute('content') ?? '';
    });
    const datePublished = await this.evaluateInDocument((document) => {
      return document.querySelector('head meta[property="og:article:published_time"]')?.getAttribute('content') ?? '';
    });
    const dateModified = await this.evaluateInDocument((document) => {
      return document.querySelector('head meta[property="og:article:modified_time"]')?.getAttribute('content') ?? '';
    });

    const authors = await this.evaluateInDocument((document) => {
      return Array.from(document.querySelectorAll(['.article__article-info .article__author a'].join(', '))).map(
        ($a) => {
          return {
            name: $a.querySelector('span')?.innerHTML ?? '',
            url: $a.getAttribute('href') ? 'https://www.morningstar.com' + $a.getAttribute('href') : undefined,
          };
        }
      );
    });
    const imageUrl = await this.evaluateInDocument((document) => {
      return document.querySelector('head meta[property="og:image"]')?.getAttribute('content') ?? '';
    });

    const languageCode = await this.evaluateInDocument((document) => {
      return document.querySelector('html')?.getAttribute('lang') ?? '';
    });

    // Content
    const content = await this.evaluateInDocument((document) => {
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
