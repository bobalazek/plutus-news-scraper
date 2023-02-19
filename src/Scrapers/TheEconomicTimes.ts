import { convert } from 'html-to-text';

import { NewsArticleDataNotFoundError } from '../Errors/NewsArticleDataNotFoundError';
import { NewsArticleType } from '../Schemas/NewsArticleSchema';
import { NewsBasicArticleType } from '../Schemas/NewsBasicArticleSchema';
import { logger } from '../Services/Logger';
import { NewsArticleMultimediaTypeEnum } from '../Types/NewsArticleMultimediaTypeEnum';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';
import { AbstractNewsScraper } from './AbstractNewsScraper';

export default class TheEconomicTimesNewsScraper extends AbstractNewsScraper implements NewsScraperInterface {
  key: string = 'the_economic_times';
  domain: string = 'economictimes.indiatimes.com';
  recentArticleListUrls: string[] = [
    'https://economictimes.indiatimes.com/markets',
    'https://economictimes.indiatimes.com/industry',
    'https://economictimes.indiatimes.com/small-biz',
    'https://economictimes.indiatimes.com/news/politics',
    'https://economictimes.indiatimes.com/personal-finance',
    'https://economictimes.indiatimes.com/mutual-funds',
    'https://economictimes.indiatimes.com/tech',
    'https://economictimes.indiatimes.com/jobs',
  ];

  async scrapeRecentArticles(urls?: string[]): Promise<NewsBasicArticleType[]> {
    const basicArticles: NewsBasicArticleType[] = [];
    const recentArticleListUrls = Array.isArray(urls) ? urls : this.recentArticleListUrls;

    const page = await this.getPuppeteerPage();

    logger.info(`Starting to scrape the recent articles on The Economic Times ...`);

    for (const recentArticleListUrl of recentArticleListUrls) {
      logger.info(`Going to URL ${recentArticleListUrl} ...`);

      await page.waitForTimeout(1000);
      await page.goto(recentArticleListUrl, { waitUntil: 'domcontentloaded' });

      const articleUrls = this.getUniqueArray(
        await page.evaluate(() => {
          // Get all the possible (anchor) elements that have the links to articles
          const querySelector = [
            '.newsList li a',
            '.topStories li a',
            '.section_list .featured a',
            '.top-news li a',
            '.secBox ul li a',
            '#bottomContent h3 a',
            '#featuredNews .newslist a',
            '.newslist a',
            '#pageContent .mainStory a',
            '.sideStories h4 a',
            '#pageContent .eachStory h3 a',
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
          return `https://economictimes.indiatimes.com${uri}`;
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
    const urlId = urlSplit[urlSplit.length - 1];
    const newsSiteArticleId = urlId.replace('.cms', '');

    const linkedDataText = await page.evaluate(() => {
      return document.querySelectorAll('body script[type="application/ld+json"]')[1].innerHTML ?? '';
    });
    if (!linkedDataText) {
      throw new NewsArticleDataNotFoundError(`Linked data not found for URL ${url}`);
    }

    const linkedData = JSON.parse(linkedDataText);

    // Content
    const content = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.article_wrap .pageContent'))
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
      imageUrl: linkedData.image,
    };

    return Promise.resolve(article);
  }

  private _preProcessUrl(url: string): string {
    const urlObject = new URL(url);

    return url.replace(urlObject.search, '').replace(urlObject.hash, '');
  }
}
