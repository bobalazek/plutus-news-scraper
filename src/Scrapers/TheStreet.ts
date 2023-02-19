import { NewsArticleDataNotFoundError } from '../Errors/NewsArticleDataNotFoundError';
import { NewsArticleType } from '../Schemas/NewsArticleSchema';
import { NewsBasicArticleType } from '../Schemas/NewsBasicArticleSchema';
import { logger } from '../Services/Logger';
import { NewsArticleMultimediaTypeEnum } from '../Types/NewsArticleMultimediaTypeEnum';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';
import { AbstractNewsScraper } from './AbstractNewsScraper';

export default class TheStreetNewsScraper extends AbstractNewsScraper implements NewsScraperInterface {
  key: string = 'the_street';
  domain: string = 'realmoney.thestreet.com';
  recentArticleListUrls: string[] = [
    'https://realmoney.thestreet.com/index',
    'https://realmoney.thestreet.com/investing',
    'https://realmoney.thestreet.com/markets',
    'https://realmoney.thestreet.com/today',
  ];

  async scrapeRecentArticles(urls?: string[]): Promise<NewsBasicArticleType[]> {
    const basicArticles: NewsBasicArticleType[] = [];
    const recentArticleListUrls = Array.isArray(urls) ? urls : this.recentArticleListUrls;

    const page = await this.getPuppeteerPage();

    logger.info(`Starting to scrape the recent articles on The Street ...`);

    for (const recentArticleListUrl of recentArticleListUrls) {
      logger.info(`Going to URL ${recentArticleListUrl} ...`);

      await page.goto(recentArticleListUrl, {
        waitUntil: 'domcontentloaded',
      });

      const articleUrls = this.getUniqueArray(
        await page.evaluate(() => {
          // Get all the possible (anchor) elements that have the links to articles
          const querySelector = [
            '.featured-categories .featured-categories__item a',
            '#newsListCompact .news-list-compact__block a',
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
          return href !== ''; // Now we want to filter out any links that are '', just in case
        })
        .map((uri) => {
          return `https://realmoney.thestreet.com${uri}`;
        });

      logger.info(`Found ${articleUrls.length} articles on this page`);

      for (const articleUrl of articleUrls) {
        const url = this._preProcessUrl(articleUrl);

        logger.debug(`Article URL: ${url}`);

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
    const page = await this.getPuppeteerPage();

    const url = this._preProcessUrl(basicArticle.url);

    logger.info(`Going to URL ${url} ...`);

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
    });

    const urlSplit = url.split('/');
    const slug = urlSplit[urlSplit.length - 1];
    const slugSplit = slug.split('-');

    const newsSiteArticleId = slugSplit[slugSplit.length - 1];

    const authorUrl = await page.evaluate(() => {
      return (
        document.querySelector('.article-author-rail a.article-author-rail__author-link')?.getAttribute('href') ?? ''
      );
    });

    const categoryUrlSplit = url;
    const categoryUrl = categoryUrlSplit.substring(0, url.lastIndexOf('/'));

    const linkedDataText = await page.evaluate(() => {
      return document.querySelector('head script[type="application/ld+json"]')?.innerHTML ?? '';
    });
    if (!linkedDataText) {
      throw new NewsArticleDataNotFoundError(`Linked data not found for URL ${url}`);
    }

    const linkedData = JSON.parse(linkedDataText);

    const article: NewsArticleType = {
      url: url,
      title: linkedData[0].headline,
      multimediaType: NewsArticleMultimediaTypeEnum.TEXT,
      content: linkedData[0].articleBody,
      newsSiteArticleId: newsSiteArticleId,
      publishedAt: new Date(linkedData[0].datePublished),
      modifiedAt: new Date(linkedData[0].dateModified),
      authors: [{ name: linkedData[0].author, url: authorUrl }],
      categories: [{ name: linkedData[0].articleSection, url: categoryUrl }],
      imageUrl: linkedData[0].image.url,
    };

    return Promise.resolve(article);
  }

  private _preProcessUrl(url: string): string {
    const urlObject = new URL(url);

    return url.replace(urlObject.search, '').replace(urlObject.hash, '');
  }
}
