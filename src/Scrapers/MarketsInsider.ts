import { NewsArticleDataNotFoundError } from '../Errors/NewsArticleDataNotFoundError';
import { NewsArticleType } from '../Schemas/NewsArticleSchema';
import { NewsBasicArticleType } from '../Schemas/NewsBasicArticleSchema';
import { NewsArticleMultimediaTypeEnum } from '../Types/NewsArticleMultimediaTypeEnum';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';
import { getUniqueArray, sleep } from '../Utils/Helpers';
import { AbstractNewsScraper } from './AbstractNewsScraper';

export default class MarketsInsiderNewsScraper extends AbstractNewsScraper implements NewsScraperInterface {
  key: string = 'markets_insider';
  domain: string = 'markets.businessinsider.com';
  recentArticleListUrls: string[] = [
    'https://markets.businessinsider.com/',
    'https://markets.businessinsider.com/stocks',
    'https://markets.businessinsider.com/indices',
    'https://markets.businessinsider.com/commodities',
    'https://markets.businessinsider.com/cryptocurrencies',
    'https://markets.businessinsider.com/currencies',
    'https://markets.businessinsider.com/etfs',
    'https://markets.businessinsider.com/news',
  ];

  async scrapeRecentArticles(urls?: string[]): Promise<NewsBasicArticleType[]> {
    const basicArticles: NewsBasicArticleType[] = [];
    const recentArticleListUrls = Array.isArray(urls) ? urls : this.recentArticleListUrls;

    this._logger.info(`Starting to scrape the recent articles on Markets Insider ...`);

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
            '.top-story .top-story__story a.top-story__link',
            '.instrument-stories .instrument-stories__story  a.instrument-stories__link',
            '.popular-articles .popular-articles__story a.popular-articles__link',
            '.site-content .image-news-list__story a.image-news-list__link',
          ].join(', ');

          // Fetch those with the .querySelectoAll() and convert it to an array
          const $elements = Array.from(document.querySelectorAll(querySelector));

          // Loop/map through those elements and get the href artibute
          return $elements.map(($el) => {
            return $el.getAttribute('href') ?? ''; // Needs to have a '' (empty string) as a fallback, because otherwise it could be null, which we don't want
          });
        })
      ).map((uri) => {
        return `https://markets.businessinsider.com${uri}`;
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

    const newsSiteArticleId = await this.evaluateInDocument((document) => {
      return document.querySelector('head meta[name="viking-id"]')?.getAttribute('value') ?? '';
    });

    const categories = await this.evaluateInDocument((document) => {
      return Array.from(document.querySelectorAll(['.post-meta .post-breadcrumbs a:last-child'].join(', '))).map(
        ($a) => {
          return {
            name: ($a.innerHTML ?? '').trim(),
            url: $a.getAttribute('href') ? 'https://markets.businessinsider.com' + $a.getAttribute('href') : undefined,
          };
        }
      );
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

    const linkedData = JSON.parse(linkedDataText);

    const article: NewsArticleType = {
      url: url,
      title: linkedData.headline,
      multimediaType: NewsArticleMultimediaTypeEnum.TEXT,
      content: linkedData.articleBody,
      newsSiteArticleId: newsSiteArticleId,
      publishedAt: new Date(linkedData.datePublished),
      modifiedAt: new Date(linkedData.dateModified),
      authors: [linkedData.author].map((author) => {
        return {
          ...author,
          url: author.url ? author.url : author.sameAs,
        };
      }),
      categories: categories,
      imageUrl: linkedData.image.url,
      languageCode: languageCode,
    };

    return Promise.resolve(article);
  }

  private _preProcessUrl(url: string): string {
    const urlObject = new URL(url);

    return url.replace(urlObject.search, '').replace(urlObject.hash, '');
  }
}
