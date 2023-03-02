import { convert } from 'html-to-text';

import { NewsArticleDataNotFoundError } from '../Errors/NewsArticleDataNotFoundError';
import { NewsArticleType } from '../Schemas/NewsArticleSchema';
import { NewsBasicArticleType } from '../Schemas/NewsBasicArticleSchema';
import { NewsArticleMultimediaTypeEnum } from '../Types/NewsArticleMultimediaTypeEnum';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';
import { getUniqueArray, sleep } from '../Utils/Helpers';
import { AbstractNewsScraper } from './AbstractNewsScraper';

export default class ABCNewsNewsScraper extends AbstractNewsScraper implements NewsScraperInterface {
  key: string = 'abc_news';
  domain: string = 'abcnews.go.com';
  recentArticleListUrls: string[] = [
    'https://abcnews.go.com',
    'https://abcnews.go.com/US',
    'https://abcnews.go.com/International',
    'https://abcnews.go.com/Business',
    'https://abcnews.go.com/Politics',
    'https://abcnews.go.com/Technology',
    'https://abcnews.go.com/Health',
  ];

  useJSDOM: boolean = true;

  async scrapeRecentArticles(urls?: string[]): Promise<NewsBasicArticleType[]> {
    const basicArticles: NewsBasicArticleType[] = [];
    const recentArticleListUrls = Array.isArray(urls) ? urls : this.recentArticleListUrls;

    this._logger.info(`Starting to scrape the recent articles on ABCNews ...`);

    for (const recentArticleListUrl of recentArticleListUrls) {
      this._logger.info(`Going to URL ${recentArticleListUrl} ...`);

      await sleep(1000);
      await this.goToPage(recentArticleListUrl, {
        waitUntil: 'domcontentloaded',
      });

      const articleUrls = getUniqueArray(
        await this.evaluateInDocument((document) => {
          const querySelector = [
            '.ContentList a.AnchorLink',
            '.ContentRoll a.AnchorLink',
            '.LatestHeadlinesBlock a.AnchorLink',
            '.HeadlineStackBlock__headlines_triple a.AnchorLink',
            '.HeadlinesTrio a.AnchorLink',
            '.VideoCarousel__Container a.AnchorLink',
          ].join(', ');

          const $elements = Array.from(document.querySelectorAll(querySelector));

          return $elements.map(($el) => {
            return $el.getAttribute('href') ?? '';
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
          // on the list (recent and archived articles) scrape
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

    const urlSplit = url.split('-');
    const urlId = urlSplit[urlSplit.length - 1];
    const newsSiteArticleId = urlId.includes('?id=') ? urlId.split('?id=')[1] : urlId;

    const languageCode = await this.evaluateInDocument((document) => {
      return document.querySelector('html')?.getAttribute('lang') ?? '';
    });

    const linkedDataText = await this.evaluateInDocument((document) => {
      return document.querySelector('head script[type="application/ld+json"]')?.innerHTML ?? '';
    });
    if (!linkedDataText) {
      throw new NewsArticleDataNotFoundError(`Linked data not found for URL ${url}`);
    }

    const linkedData = JSON.parse(linkedDataText);

    // Content
    const content = await this.evaluateInDocument((document) => {
      return Array.from(document.querySelectorAll('article[data-testid="prism-article-body"] p'))
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      authors: linkedData.author.map((author: any) => {
        return {
          ...author,
          url: (author.url.startsWith('/') ? `https://abcnews.go.com${author.url}` : author.url) || undefined,
        };
      }),
      imageUrl: linkedData.image.url,
      languageCode: languageCode,
    };

    return Promise.resolve(article);
  }

  private _preProcessUrl(url: string): string {
    const urlObject = new URL(url);

    return url.replace(urlObject.hash, '');
  }
}
