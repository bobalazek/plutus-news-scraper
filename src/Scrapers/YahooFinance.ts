import { convert } from 'html-to-text';
import { NewsArticle, WithContext } from 'schema-dts';

import { NewsArticleDataNotFoundError } from '../Errors/NewsArticleDataNotFoundError';
import { NewsArticleType } from '../Schemas/NewsArticleSchema';
import { NewsBasicArticleType } from '../Schemas/NewsBasicArticleSchema';
import { NewsArticleMultimediaTypeEnum } from '../Types/NewsArticleMultimediaTypeEnum';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';
import { getNewsArticleLinkedData, getUniqueArray, sleep } from '../Utils/Helpers';
import { AbstractNewsScraper } from './AbstractNewsScraper';

export default class YahooFinanceNewsScraper extends AbstractNewsScraper implements NewsScraperInterface {
  key: string = 'yahoo_finance';
  domain: string = 'finance.yahoo.com';
  recentArticleListUrls: string[] = [
    'https://finance.yahoo.com/',
    'https://finance.yahoo.com/crypto/',
    'https://finance.yahoo.com/news/',
    'https://finance.yahoo.com/calendar/',
    'https://finance.yahoo.com/screener/predefined/ms_basic_materials/',
  ];

  useJSDOM: boolean = false;

  async scrapeRecentArticles(urls?: string[]): Promise<NewsBasicArticleType[]> {
    const basicArticles: NewsBasicArticleType[] = [];
    const recentArticleListUrls = Array.isArray(urls) ? urls : this.recentArticleListUrls;

    this._logger.info(`Starting to scrape the recent articles on Yahoo ...`);

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
          const querySelector = [
            '.article-cluster-boundary a',
            '.js-stream-content a',
            '.crypto-trending-news h4 a',
          ].join(', ');

          // Fetch those with the .querySelectoAll() and convert it to an array
          const $elements = Array.from(document.querySelectorAll(querySelector));

          // Loop/map through those elements and get the href artibute
          return $elements.map(($el) => {
            const href = $el.getAttribute('href') ?? '';
            if (href.startsWith('/')) {
              return `https://finance.yahoo.com${href}`;
            }

            if (href.startsWith('https://finance.yahoo.com')) {
              return href;
            }

            return '';
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
      waitUntil: 'networkidle2',
    });

    const $consentPageDiv = await this.evaluateInDocument((document) => {
      return document.querySelector('#consent-page');
    });
    if ($consentPageDiv) {
      await this.clickOnPage('#consent-page .actions button[value="agree"]');
      await this.goToPage(url, {
        waitUntil: 'networkidle2',
      });
    }

    const urlSplit = url.split('/');
    const slug = urlSplit[urlSplit.length - 1];
    const slugSplit = slug.split('-');

    const slugLastPart = slugSplit[slugSplit.length - 1];
    const newsSiteArticleId = slugLastPart.replace('.html', '');

    const languageCode = await this.evaluateInDocument((document) => {
      return document.querySelector('html')?.getAttribute('lang') ?? '';
    });

    const linkedDataText = await this.evaluateInDocument((document) => {
      return document.querySelector('script[type="application/ld+json"]')?.innerHTML ?? '';
    });
    if (!linkedDataText) {
      throw new NewsArticleDataNotFoundError(`Linked data not found for URL ${url}`);
    }

    const linkedData = JSON.parse(linkedDataText) as WithContext<NewsArticle>;

    // Content
    const content = await this.evaluateInDocument((document) => {
      return Array.from(document.querySelectorAll('article .caas-body p'))
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
