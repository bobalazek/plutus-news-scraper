import { convert } from 'html-to-text';

import { NewsArticleDataNotFoundError } from '../Errors/NewsArticleDataNotFoundError';
import { NewsArticleType } from '../Schemas/NewsArticleSchema';
import { NewsBasicArticleType } from '../Schemas/NewsBasicArticleSchema';
import { NewsArticleMultimediaTypeEnum } from '../Types/NewsArticleMultimediaTypeEnum';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';
import { sleep } from '../Utils/Helpers';
import { AbstractNewsScraper } from './AbstractNewsScraper';

export default class AljazeeraNewsScraper extends AbstractNewsScraper implements NewsScraperInterface {
  key: string = 'aljazeera';
  domain: string = 'www.aljazeera.com';
  recentArticleListUrls: string[] = [
    'https://www.aljazeera.com/',
    'https://www.aljazeera.com/news/',
    'https://www.aljazeera.com/features/',
    'https://www.aljazeera.com/economy/',
    'https://www.aljazeera.com/climate-crisis',
    'https://www.aljazeera.com/investigations/',
  ];

  async scrapeRecentArticles(urls?: string[]): Promise<NewsBasicArticleType[]> {
    const basicArticles: NewsBasicArticleType[] = [];
    const recentArticleListUrls = Array.isArray(urls) ? urls : this.recentArticleListUrls;

    this._logger.info(`Starting to scrape the recent articles on Aljazeera ...`);

    for (const recentArticleListUrl of recentArticleListUrls) {
      this._logger.info(`Going to URL ${recentArticleListUrl} ...`);

      await sleep(1000);
      await this.goToPage(recentArticleListUrl, {
        waitUntil: 'domcontentloaded',
      });

      const articleUrls = this.getUniqueArray(
        await this.evaluateInDocument(() => {
          // Get all the possible (anchor) elements that have the links to articles
          const querySelector = ['#featured-news-container article a', '#news-feed-container article a'].join(', ');

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
          return `https://www.aljazeera.com${uri}`;
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

    await this.goToPage(url, {
      waitUntil: 'domcontentloaded',
    });

    const newsSiteArticleId = await this.evaluateInDocument(() => {
      return document.querySelector('head meta[name="postID"]')?.getAttribute('content') ?? '';
    });

    const categories = await this.evaluateInDocument(() => {
      return Array.from(document.querySelectorAll(['#main-content-area .article-header .topics a'].join(', '))).map(
        ($a) => {
          return {
            name: $a.innerHTML,
            url: $a.getAttribute('href') ? 'https://www.aljazeera.com' + $a.getAttribute('href') : undefined,
          };
        }
      );
    });

    const languageCode = await this.evaluateInDocument(() => {
      return document.querySelector('html')?.getAttribute('lang') ?? '';
    });

    const linkedDataText = await this.evaluateInDocument(() => {
      return document.querySelector('head script[type="application/ld+json"]')?.innerHTML ?? '';
    });
    if (!linkedDataText) {
      throw new NewsArticleDataNotFoundError(`Linked data not found for URL ${url}`);
    }

    const linkedData = JSON.parse(linkedDataText);

    // Content
    const content = await this.evaluateInDocument(() => {
      return Array.from(document.querySelectorAll('#main-content-area p'))
        .map((element) => {
          return element.innerHTML;
        })
        .join('');
    });

    const article: NewsArticleType = {
      url: url,
      title: linkedData.headline,
      multimediaType: NewsArticleMultimediaTypeEnum.TEXT,
      content: convert(content, {
        wordwrap: false,
      }),
      newsSiteArticleId: newsSiteArticleId,
      publishedAt: new Date(linkedData.datePublished),
      modifiedAt: new Date(linkedData.dateModified),
      authors: [linkedData.author],
      categories: categories,
      imageUrl: linkedData.image[0].url,
      languageCode: languageCode,
    };

    return Promise.resolve(article);
  }

  private _preProcessUrl(url: string): string {
    const urlObject = new URL(url);

    return url.replace(urlObject.search, '').replace(urlObject.hash, '');
  }
}
