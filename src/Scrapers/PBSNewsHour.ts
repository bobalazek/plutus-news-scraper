import { convert } from 'html-to-text';

import { NewsArticleDataNotFoundError } from '../Errors/NewsArticleDataNotFoundError';
import { NewsArticleType } from '../Schemas/NewsArticleSchema';
import { NewsBasicArticleType } from '../Schemas/NewsBasicArticleSchema';
import { NewsArticleMultimediaTypeEnum } from '../Types/NewsArticleMultimediaTypeEnum';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';
import { sleep } from '../Utils/Helpers';
import { AbstractNewsScraper } from './AbstractNewsScraper';

export default class PbsNewsHourNewsScraper extends AbstractNewsScraper implements NewsScraperInterface {
  key: string = 'pbs_news_hour';
  domain: string = 'www.pbs.org';
  recentArticleListUrls: string[] = [
    'https://www.pbs.org/newshour',
    'https://www.pbs.org/newshour/latest',
    'https://www.pbs.org/newshour/politics',
    'https://www.pbs.org/newshour/nation',
    'https://www.pbs.org/newshour/world',
    'https://www.pbs.org/newshour/economy',
    'https://www.pbs.org/newshour/science',
    'https://www.pbs.org/newshour/education',
  ];

  async scrapeRecentArticles(urls?: string[]): Promise<NewsBasicArticleType[]> {
    const basicArticles: NewsBasicArticleType[] = [];
    const recentArticleListUrls = Array.isArray(urls) ? urls : this.recentArticleListUrls;

    const page = await this.getPuppeteerPage();

    this._logger.info(`Starting to scrape the recent articles on PBS News Hour ...`);

    for (const recentArticleListUrl of recentArticleListUrls) {
      this._logger.info(`Going to URL ${recentArticleListUrl} ...`);

      await sleep(1000);
      await page.goto(recentArticleListUrl, {
        waitUntil: 'domcontentloaded',
      });

      const articleUrls = this.getUniqueArray(
        await page.evaluate(() => {
          // Get all the possible (anchor) elements that have the links to articles
          const querySelector = [
            '.page__body .home-hero__body a',
            '.home-hero__related article .card-sm__body a',
            '.page__body .card-timeline .card-timeline__intro a',
            '.page__body .archive__cards a.card-xl__title',
            '.page__body .archive-grid a.card-lg__title',
            '.page__body .archive-list a.card-horiz__title',
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

    const page = await this.getPuppeteerPage();
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
    });

    const bodyClasses = await page.evaluate(() => {
      return document.querySelector('body')?.getAttribute('class') ?? '';
    });

    const bodyPostIdClass = bodyClasses.split(' ').find((singleClass) => {
      return singleClass.startsWith('postid-');
    });

    if (!bodyPostIdClass) {
      throw new NewsArticleDataNotFoundError(`No post id data found for URL ${url}`);
    }

    const newsSiteArticleId = bodyPostIdClass.replace('postid-', '');

    const datePublished = await page.evaluate(() => {
      return document.querySelector('head meta[property="article:published_time"]')?.getAttribute('content') ?? '';
    });
    const dateModified = await page.evaluate(() => {
      return document.querySelector('head meta[property="article:published_time"]')?.getAttribute('content') ?? '';
    });
    const title = await page.evaluate(() => {
      return document.querySelector('head meta[property="og:title"]')?.getAttribute('content') ?? '';
    });

    const authors = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll(
          ['.post__byline.post__byline--side .post__byline-address a[itemprop="author"]'].join(', ')
        )
      ).map(($a) => {
        return {
          name: $a.querySelector('span[itemprop="name"]')?.innerHTML ?? '',
          url: $a.getAttribute('href') ?? undefined,
        };
      });
    });

    const categories = await page.evaluate(() => {
      return Array.from(document.querySelectorAll(['.post__article a.post__category'].join(', '))).map(($a) => {
        return {
          name: $a.innerHTML ?? '',
          url: $a.getAttribute('href') ?? undefined,
        };
      });
    });

    const imageUrl = await page.evaluate(() => {
      return document.querySelector('head meta[property="og:image"]')?.getAttribute('content') ?? '';
    });

    const languageCode = await page.evaluate(() => {
      return document.querySelector('html')?.getAttribute('lang') ?? '';
    });

    // Content
    const content = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('article .body-text p'))
        .map((element) => {
          return element.innerHTML;
        })
        .join('');
    });

    const article: NewsArticleType = {
      url: url,
      title: title,
      multimediaType: NewsArticleMultimediaTypeEnum.TEXT,
      content: convert(content, {
        wordwrap: false,
      }),
      newsSiteArticleId: newsSiteArticleId,
      publishedAt: new Date(datePublished),
      modifiedAt: new Date(dateModified),
      authors: authors,
      categories: categories,
      imageUrl: imageUrl,
      languageCode: languageCode,
    };

    return Promise.resolve(article);
  }

  private _preProcessUrl(url: string): string {
    const urlObject = new URL(url);

    return url.replace(urlObject.search, '').replace(urlObject.hash, '');
  }
}
