import { convert } from 'html-to-text';

import { NewsArticleDataNotFoundError } from '../Errors/NewsArticleDataNotFoundError';
import { logger } from '../Services/Logger';
import { NewsArticleInterface } from '../Types/NewsArticleInterface';
import { NewsArticleMultimediaTypeEnum } from '../Types/NewsArticleMultimediaTypeEnum';
import { NewsBasicArticleInterface } from '../Types/NewsBasicArticleInterface';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';
import { AbstractNewsScraper } from './AbstractNewsScraper';

export default class TheWallStreetJournalNewsScraper extends AbstractNewsScraper implements NewsScraperInterface {
  key: string = 'wsj';
  domain: string = 'www.wsj.com';
  recentArticleListUrls: string[] = [
    'https://www.wsj.com/news/world?mod=nav_top_section',
    'https://www.wsj.com/news/us?mod=nav_top_section',
    'https://www.wsj.com/news/politics?mod=nav_top_section',
    'https://www.wsj.com/news/economy?mod=nav_top_section',
    'https://www.wsj.com/news/business?mod=nav_top_section',
    'https://www.wsj.com/news/technology?mod=nav_top_section',
    'https://www.wsj.com/news/markets?mod=nav_top_section',
    'https://www.wsj.com/news/opinion?mod=nav_top_section',
    'https://www.wsj.com/news/books-arts?mod=nav_top_section',
    'https://www.wsj.com/news/realestate?mod=nav_top_section',
  ];

  async scrapeRecentArticles(urls?: string[]): Promise<NewsBasicArticleInterface[]> {
    const basicArticles: NewsBasicArticleInterface[] = [];
    const recentArticleListUrls = Array.isArray(urls) ? urls : this.recentArticleListUrls;

    const page = await this.getPuppeteerPage();

    logger.info(`Starting to scrape the recent articles on The Wall Street Journal ...`);

    for (const recentArticleListUrl of recentArticleListUrls) {
      logger.info(`Going to URL ${recentArticleListUrl} ...`);

      await page.goto(recentArticleListUrl, {
        waitUntil: 'domcontentloaded',
      });

      const articleUrls = this.getUniqueArray(
        await page.evaluate(() => {
          // Get all the possible (anchor) elements that have the links to articles
          const querySelector = [
            '#top-news div[class^="WSJTheme--headline--"] a',
            'article div[class^="WSJTheme--headline--"] a',
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
          // on the list (recent  and archived articles) scrape
          url: url,
        });
      }
    }

    await this.closePuppeteerBrowser();

    return Promise.resolve(this.getUniqueArray(basicArticles));
  }

  async scrapeArticle(basicArticle: NewsBasicArticleInterface): Promise<NewsArticleInterface | null> {
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

    const categories = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll(['.article_header .category li.article-breadCrumb a'].join(', '))
      ).map(($a) => {
        return {
          name: $a.innerHTML,
          url: $a.getAttribute('href') ?? undefined,
        };
      });
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
      return Array.from(document.querySelectorAll('#main .wsj-snippet-body p'))
        .map((element) => {
          return element.innerHTML;
        })
        .join('');
    });

    await this.closePuppeteerBrowser();

    const article: NewsArticleInterface = {
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
      categories: categories,
      imageUrl: linkedData.image[0],
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
