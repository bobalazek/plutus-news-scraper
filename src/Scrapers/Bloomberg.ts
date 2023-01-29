import { AbstractNewsScraper } from '../AbstractNewsScraper';
import { logger } from '../Logger';
import { NewsArticleTypeEnum } from '../Types/Enums';
import { NewsArticleInterface, NewsBasicArticleInterface, NewsScraperInterface } from '../Types/Interfaces';

export default class BloombergScraper extends AbstractNewsScraper implements NewsScraperInterface {
  key: string = 'bloomberg';
  domain: string = 'bloomberg.com';
  domainAliases: string[] = ['www.bloomberg.com'];

  async scrapeRecentArticles(): Promise<NewsBasicArticleInterface[]> {
    const basicArticles: NewsBasicArticleInterface[] = []; // Initialise an empty array, where we can save the article data (mainly the URL)
    const recentArticleListUrls = [
      // Add all the page/category URLs that you want to scrape, so you get the actual article URLS
      'https://www.bloomberg.com/europe',
      /* 'https://www.bloomberg.com/uk',
      'https://www.bloomberg.com/',
      'https://www.bloomberg.com/asia',
      'https://www.bloomberg.com/middleeast',
      'https://www.bloomberg.com/africa', */
    ];

    const browser = await this.getPuppeteerBrowser({
      headless: false,
    });
    const page = await browser.newPage();

    logger.info(`Starting to scrape the recent articles on Bloomberg ...`);

    for (const recentArticleListUrl of recentArticleListUrls) {
      logger.info(`Going to URL ${recentArticleListUrl} ...`);

      await page.goto(recentArticleListUrl, {
        waitUntil: 'domcontentloaded',
      });

      const articleUrls = this.getUniqueArray(
        await page.evaluate(() => {
          // Get all the possible (anchor) elements that have the links to articles
          const querySelector = [
            '.single-story-module__info .single-story-module__eyebrow a.single-story-module__headline-link',
            '.single-story-module__info .single-story-module__related-stories a.single-story-module__related-story-link',
            '.story-list-module__info a.story-list-story__info__headline-link',
            '.story-list-story__info a.story-list-story__info__headline-link',
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
            })
            .map((uri) => {
              return `https://www.bloomberg.com${uri}`;
            });
        })
      );

      logger.info(`Found ${articleUrls.length} articles on this page`);

      for (const articleUrl of articleUrls) {
        logger.debug(`Article URL: ${articleUrl}`);

        basicArticles.push({
          // We are actually pushing a basic article object, instead of just URL,
          // if in the future we for example maybe want to provide some more metadata
          // on the list (recent and archived articles) scrape
          url: articleUrl,
        });
      }
    }

    await browser.close();

    return Promise.resolve(this.getUniqueArray(basicArticles));
  }

  async scrapeArticle(basicArticle: NewsBasicArticleInterface): Promise<NewsArticleInterface | null> {
    const browser = await this.getPuppeteerBrowser();
    const page = await browser.newPage();
    page.setUserAgent(this.getDefaultUserAgent());

    const url = this.preProcessUrl(basicArticle.url);
    const newsSiteArticleId = url;

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

    const linkedData = JSON.parse(linkedDataText);

    // Content
    const content = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('article .body-content p'))
        .map((element) => {
          return element.innerHTML;
        })
        .join('');
    });

    await browser.close();

    const article = {
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

  preProcessUrl(url: string): string {
    const urlObject = new URL(url);

    return url.replace(urlObject.search, '').replace(urlObject.hash, '');
  }
}
