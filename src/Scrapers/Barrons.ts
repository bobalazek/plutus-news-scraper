import { convert } from 'html-to-text';

import { NewsArticleDataNotFoundError } from '../Errors/NewsArticleDataNotFoundError';
import { NewsArticleType } from '../Schemas/NewsArticleSchema';
import { NewsBasicArticleType } from '../Schemas/NewsBasicArticleSchema';
import { logger } from '../Services/Logger';
import { NewsArticleMultimediaTypeEnum } from '../Types/NewsArticleMultimediaTypeEnum';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';
import { AbstractNewsScraper } from './AbstractNewsScraper';

export default class BarronsNewsScraper extends AbstractNewsScraper implements NewsScraperInterface {
  key: string = 'barrons';
  domain: string = 'www.barrons.com';
  recentArticleListUrls: string[] = [
    'https://www.barrons.com/',
    'https://www.barrons.com/topics/markets',
    'https://www.barrons.com/topics/europe',
    'https://www.barrons.com/topics/asia',
    'https://www.barrons.com/topics/emerging-markets',
    'https://www.barrons.com/topics/funds',
    'https://www.barrons.com/market-data/stocks/stock-picks',
    'https://www.barrons.com/topics/ceos-and-thought-leaders',
    'https://www.barrons.com/topics/streetwise',
    'https://www.barrons.com/topics/technology',
    'https://www.barrons.com/topics/bonds',
    'https://www.barrons.com/topics/commodities',
    'https://www.barrons.com/topics/sustainable-investing',
    'https://www.barrons.com/topics/financial-planning',
    'https://www.barrons.com/topics/retirement',
    'https://www.barrons.com/topics/economy-and-policy',
    'https://www.barrons.com/topics/up-and-down-wall-street',
    'https://www.barrons.com/topics/cryptocurrencies',
    'https://www.barrons.com/topics/the-trader',
    'https://www.barrons.com/news',
  ];

  async scrapeRecentArticles(urls?: string[]): Promise<NewsBasicArticleType[]> {
    const basicArticles: NewsBasicArticleType[] = [];
    const recentArticleListUrls = Array.isArray(urls) ? urls : this.recentArticleListUrls;

    const page = await this.getPuppeteerPage();

    logger.info(`Starting to scrape the recent articles on Barrons ...`);

    for (const recentArticleListUrl of recentArticleListUrls) {
      logger.info(`Going to URL ${recentArticleListUrl} ...`);

      await page.goto(recentArticleListUrl, {
        waitUntil: 'domcontentloaded',
      });

      const articleUrls = this.getUniqueArray(
        await page.evaluate(() => {
          // Get all the possible (anchor) elements that have the links to articles
          const querySelector = [
            'div[class^="BarronsTheme-module--article"]',
            'article[class^="BarronsTheme--story--"] a',
            'div[class^="BarronsTheme__stock-picks-container___"] h4 a',
          ].join(', ');

          // Fetch those with the .querySelectoAll() and convert it to an array
          const $elements = Array.from(document.querySelectorAll(querySelector));

          // Loop/map through those elements and get the href artibute
          return $elements.map(($el) => {
            return $el.getAttribute('href') ?? ''; // Needs to have a '' (empty string) as a fallback, because otherwise it could be null, which we don't want
          });
        })
      ).filter((href) => {
        return href !== ''; // Now we want to filter out any links that are '', just in case
      });

      logger.info(`Found ${articleUrls.length} articles on this page`);

      for (const articleUrl of articleUrls) {
        const url = this._preProcessUrl(articleUrl);

        logger.debug(`Article URL: ${url}`);

        basicArticles.push({
          // We are actually pushing a basic article object, instead of just URL,
          // if in the future we for example maybe want to provide some more metadata
          // on the list (recent and archived articles) scrape
          url: url,
        });
      }
    }

    return Promise.resolve(this.getUniqueArray(basicArticles));
  }

  async scrapeArticle(basicArticle: NewsBasicArticleType): Promise<NewsArticleType> {
    const page = await this.getPuppeteerPage();

    const url = this._preProcessUrl(basicArticle.url);

    logger.info(`Going to URL ${url} ...`);

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
    });

    const urlSplit = url.split('-');
    const urlId = urlSplit[urlSplit.length - 1];

    const newsSiteArticleId = urlId ?? url;

    const languageCode = await page.evaluate(() => {
      return document.querySelector('head meta[name="language"]')?.getAttribute('content') ?? '';
    });

    const linkedDataText = await page.evaluate(() => {
      return document.querySelector('head script[type="application/ld+json"]')?.innerHTML ?? '';
    });
    if (!linkedDataText) {
      throw new NewsArticleDataNotFoundError(`Linked data not found for URL ${url}`);
    }

    const linkedData = JSON.parse(linkedDataText)[0];

    // Content
    const content = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('main .article-body p, #article_sector .snippet__body'))
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
      authors: linkedData.author,
      imageUrl: linkedData.image[0],
      languageCode: languageCode,
    };

    return Promise.resolve(article);
  }

  private _preProcessUrl(url: string): string {
    const urlObject = new URL(url);

    return url.replace(urlObject.search, '').replace(urlObject.hash, '');
  }
}
