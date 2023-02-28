import { convert } from 'html-to-text';

import { NewsArticleDataNotFoundError } from '../Errors/NewsArticleDataNotFoundError';
import { NewsArticleType } from '../Schemas/NewsArticleSchema';
import { NewsBasicArticleType } from '../Schemas/NewsBasicArticleSchema';
import { NewsArticleMultimediaTypeEnum } from '../Types/NewsArticleMultimediaTypeEnum';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';
import { sleep } from '../Utils/Helpers';
import { AbstractNewsScraper } from './AbstractNewsScraper';

export default class SeekingAlphaNewsScraper extends AbstractNewsScraper implements NewsScraperInterface {
  key: string = 'seeking_alpha';
  domain: string = 'seekingalpha.com';
  recentArticleListUrls: string[] = [
    'https://seekingalpha.com/market-news',
    'https://seekingalpha.com/market-outlook',
    'https://seekingalpha.com/stock-ideas',
    'https://seekingalpha.com/dividends',
    'https://seekingalpha.com/etfs-and-funds',
    'https://seekingalpha.com/market-news/technology',
    'https://seekingalpha.com/market-news/energy',
    'https://seekingalpha.com/market-news/healthcare',
    'https://seekingalpha.com/market-news/crypto',
  ];

  async scrapeRecentArticles(urls?: string[]): Promise<NewsBasicArticleType[]> {
    const basicArticles: NewsBasicArticleType[] = [];
    const recentArticleListUrls = Array.isArray(urls) ? urls : this.recentArticleListUrls;

    this._logger.info(`Starting to scrape the recent articles on Seeking Alpha ...`);

    for (const recentArticleListUrl of recentArticleListUrls) {
      this._logger.info(`Going to URL ${recentArticleListUrl} ...`);

      await sleep(1000);
      await this.goToPage(recentArticleListUrl, {
        waitUntil: 'networkidle2',
      });

      const articleUrls = this.getUniqueArray(
        await this.evaluateInDocument(() => {
          // Get all the possible (anchor) elements that have the links to articles
          const querySelector = [
            'div[data-test-id="trending-news-cards-body"] a[data-test-id="post-list-item-title"]',
            'div[data-test-id="post-list"] a[data-test-id="post-list-item-title"]',
            'section article a[data-test-id="post-list-item-title"]',
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
          return href !== '' && !href.includes('/symbol/'); // Now we want to filter out any links that are '', just in case
        })
        .map((uri) => {
          return `https://seekingalpha.com${uri}`;
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
      waitUntil: 'networkidle2',
    });

    const urlSplit = url.split('/');
    const slug = urlSplit[urlSplit.length - 1];
    const slugSplit = slug.split('-');

    const newsSiteArticleId = slugSplit[0];

    const linkedDataText = await this.evaluateInDocument(() => {
      return document.querySelector('body script[type="application/ld+json"]:nth-child(2)')?.innerHTML ?? '';
    });
    if (!linkedDataText) {
      throw new NewsArticleDataNotFoundError(`Linked data not found for URL ${url}`);
    }

    const linkedData = JSON.parse(linkedDataText);

    // Content
    const content = await this.evaluateInDocument(() => {
      return Array.from(document.querySelectorAll('div[class^="paywall-full-"]'))
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
    };

    return Promise.resolve(article);
  }

  private _preProcessUrl(url: string): string {
    const urlObject = new URL(url);

    return url.replace(urlObject.search, '').replace(urlObject.hash, '');
  }
}
