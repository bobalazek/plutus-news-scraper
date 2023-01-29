import { AbstractNewsScraper } from '../AbstractNewsScraper';
import { logger } from '../Logger';
import { NewsArticleTypeEnum } from '../Types/Enums';
import { NewsArticleInterface, NewsBasicArticleInterface, NewsScraperInterface } from '../Types/Interfaces';

export default class BarronsScraper extends AbstractNewsScraper implements NewsScraperInterface {
  key: string = 'barrons';
  domain: string = 'barrons.com';
  domainAliases: string[] = ['www.barrons.com'];

  async scrapeRecentArticles(): Promise<NewsBasicArticleInterface[]> {
    const basicArticles: NewsBasicArticleInterface[] = []; // Initialise an empty array, where we can save the article data (mainly the URL)
    const recentArticleListUrls = [
      // Add all the page/category URLs that you want to scrape, so you get the actual article URLS
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

    const browser = await this.getPuppeteerBrowser();
    const page = await browser.newPage();

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
          return $elements
            .map(($el) => {
              return $el.getAttribute('href') ?? ''; // Needs to have a '' (empty string) as a fallback, because otherwise it could be null, which we don't want
            })
            .filter((href) => {
              return href !== ''; // Now we want to filter out any links that are '', just in case
            });
        })
      );

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

    await this.closePuppeteerBrowser();

    return Promise.resolve(this.getUniqueArray(basicArticles));
  }

  async scrapeArticle(basicArticle: NewsBasicArticleInterface): Promise<NewsArticleInterface | null> {
    const browser = await this.getPuppeteerBrowser();
    const page = await browser.newPage();

    const url = this._preProcessUrl(basicArticle.url);
    const urlDashSplit = url.split('-');
    const urlDashId = urlDashSplit[urlDashSplit.length - 1];

    const newsSiteArticleId = urlDashId ?? url;

    logger.info(`Going to URL ${url} ...`);

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
    });

    const linkedDataText = await page.evaluate(() => {
      return document.querySelector('head script[type="application/ld+json"]')?.innerHTML ?? '';
    });
    if (!linkedDataText) {
      throw new Error(`No linked data found for URL ${url}`);
    }

    const linkedData = JSON.parse(linkedDataText)[0];

    // Content
    const content = await page.evaluate(() => {
      return Array.from(
        document.querySelector('#js-article__body')
          ? document.querySelectorAll('#js-article__body p, #js-article__body .paywall')
          : document.querySelector('#article-contents .article__body')
          ? document.querySelectorAll('#article-contents .article__body p')
          : []
      )
        .map((element) => {
          return element.innerHTML;
        })
        .join('');
    });

    await this.closePuppeteerBrowser();

    const article: NewsArticleInterface = {
      url: url,
      title: linkedData.headline,
      type: NewsArticleTypeEnum.TEXT,
      content: content,
      newsSiteArticleId: newsSiteArticleId,
      publishedAt: new Date(linkedData.datePublished),
      modifiedAt: new Date(linkedData.dateModified),
    };

    logger.debug(`Article data:`);
    logger.debug(article);

    return Promise.resolve(article);
  }

  private _preProcessUrl(url: string): string {
    const urlObject = new URL(url);

    return url.replace(urlObject.search, '').replace(urlObject.hash, '');
  }
}
