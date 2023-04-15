import { convert } from 'html-to-text';
import { DateTime, Interval } from 'luxon';
import { NewsArticle, WithContext } from 'schema-dts';

import { NewsArticleDataNotFoundError } from '../Errors/NewsArticleDataNotFoundError';
import { NewsArticleType } from '../Schemas/NewsArticleSchema';
import { NewsBasicArticleType } from '../Schemas/NewsBasicArticleSchema';
import { NewsArticleMultimediaTypeEnum } from '../Types/NewsArticleMultimediaTypeEnum';
import { NewsScraperGetArchivedArticlesOptionsInterface, NewsScraperInterface } from '../Types/NewsScraperInterface';
import { getNewsArticleLinkedData, getUniqueArray, sleep } from '../Utils/Helpers';
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

  useJSDOM: boolean = true;

  async scrapeRecentArticles(urls?: string[]): Promise<NewsBasicArticleType[]> {
    const basicArticles: NewsBasicArticleType[] = [];
    const recentArticleListUrls = Array.isArray(urls) ? urls : this.recentArticleListUrls;

    this._logger.info(`Starting to scrape the recent articles on Barrons ...`);

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
      );

      this._logger.info(`Found ${articleUrls.length} articles on this page`);

      for (const articleUrl of articleUrls) {
        const url = this._preProcessUrl(articleUrl);

        this._logger.debug(`Article URL: ${url}`);

        basicArticles.push({
          // We are actually pushing a basic article object, instead of just URL,
          // if in the future we for example maybe want to provide some more metadata
          // on the list (recent and archived articles) scrape
          url: url,
        });
      }
    }

    return Promise.resolve(getUniqueArray(basicArticles));
  }

  async scrapeArchivedArticles(
    options: NewsScraperGetArchivedArticlesOptionsInterface
  ): Promise<NewsBasicArticleType[]> {
    const basicArticles: NewsBasicArticleType[] = [];

    // This will hold all the URLs for pages, that actually contain the article urls,
    // for example: ['https://www.barrons.com/archive/1997/07/14', 'https://www.barrons.com/archive/1997/07/15', ...]
    const dateUrls: string[] = [];

    this._logger.info(`Starting to scrape the archived articles on Barrons ...`);

    // Option 1:
    // We can either scrape the years page first to get all the available months for each year,
    // then we go to those pages and go to those pages and get the single date (2012-01-01) to determine
    // which articles were found on that page
    /*
    const archiveYearsUrl = 'https://www.barrons.com/archive/years';
    this._logger.info(`Going to URL ${archiveYearsUrl} ...`);
    await this.goToPage(archiveYearsUrl, {
      waitUntil: 'domcontentloaded',
    });
    const yearsData = (
      await this.evaluateInDocument((document) => {
        const $yearColumns = document.querySelectorAll('div[class^="BarronsTheme--year-contain--"]');

        return (
          Array.from($yearColumns)
            .map(($yearColumn) => {
              const $monthAnchors = $yearColumn.querySelectorAll('a');
              return {
                year: parseInt($yearColumn.querySelector('h2')?.innerHTML ?? '0'),
                months: Array.from($monthAnchors).map(($monthAnchor) => {
                  return {
                    month: $monthAnchor.innerHTML?.trim(),
                    url: `https://www.barrons.com${$monthAnchor.getAttribute('href')}`,
                  };
                }),
              };
            })
            // There seem to be some empty columns at the end - those will always have a year of 0,
            // so we just filter those out.
            .filter((urlByYear) => {
              return urlByYear.year !== 0;
            })
        );
      })
    ).reverse(); // Since on the website we get the from 2023 to 1997, we want to just reverse them, so it makes more sense

    for (const yearData of yearsData) {
      for (const monthData of yearData.months) {
        this._logger.info(`Going to URL ${monthData.url} ...`);

        await sleep(1000);
        await this.goToPage(monthData.url, {
          waitUntil: 'domcontentloaded',
        });

        const dateUrlsForMonth = await this.evaluateInDocument((document) => {
          return Array.from(document.querySelectorAll('a[class^="BarronsTheme--day-link--"]')).map(($element) => {
            return `https://www.barrons.com${$element.getAttribute('href')}`;
          });
        });

        dateUrls.push(...dateUrlsForMonth);
      }
    }
    */

    // Option 2 - prefferable
    // Since we already know exactly what the URL for all those final pages will be,
    // for example: https://www.barrons.com/archive/1997/07/14 - which is: https://www.barrons.com/archive/{year}/{month}/{day}
    // we can just skip all of the scraping above, and generate those URLs programatically.
    // The only thing for that we just need to know is the start date, which we can easily figure out,
    // if we go to the archives page
    const interval = Interval.fromDateTimes(DateTime.utc(1997, 7, 14), DateTime.utc());
    const dayIntervals = interval.splitBy({ days: 1 });

    for (const dayInterval of dayIntervals) {
      if (!dayInterval.start || !dayInterval.end) {
        continue;
      }

      const year = dayInterval.start.toFormat('yyyy');
      const month = dayInterval.start.toFormat('MM');
      const day = dayInterval.start.toFormat('dd');

      if (options.from && dayInterval.start.toString() < options.from && dayInterval.end.toString() > options.from) {
        continue;
      }

      dateUrls.push(`https://www.barrons.com/archive/${year}/${month}/${day}`);
    }

    // Now go and visit each of those date pages, to get the actual article URLs
    this._logger.info(`Found ${dateUrls.length} date urls. Starting to visit one-by-one to get the articles ...`);

    for (const dateUrl of dateUrls) {
      this._logger.info(`Going to URL ${dateUrl} ...`);

      await sleep(1000);
      await this.goToPage(dateUrl, {
        waitUntil: 'domcontentloaded',
      });

      const articleUrls = getUniqueArray(
        await this.evaluateInDocument((document) => {
          return Array.from(document.querySelectorAll('a[class^="BarronsTheme--headline-link--"]')).map(($element) => {
            return $element.getAttribute('href') ?? '';
          });
        })
      );

      basicArticles.push(
        ...articleUrls.map((articleUrl) => {
          // TODO: seems like a lot of the initial articles redirect to www.wsj.com,
          // which is then redirected back to barrons.com. We could probably just check
          // if the url contains www.wsj.com and get the ID, and then go back to the wsj.com page

          return {
            url: articleUrl,
          };
        })
      );
    }

    return basicArticles;
  }

  async scrapeArticle(basicArticle: NewsBasicArticleType): Promise<NewsArticleType> {
    const url = this._preProcessUrl(basicArticle.url);

    this._logger.info(`Going to URL ${url} ...`);

    await this.goToPage(url, {
      waitUntil: 'domcontentloaded',
    });

    const urlSplit = url.split('-');
    const urlId = urlSplit[urlSplit.length - 1];

    const newsSiteArticleId = urlId ?? url;

    const languageCode = await this.evaluateInDocument((document) => {
      return document.querySelector('head meta[name="language"]')?.getAttribute('content') ?? '';
    });

    const linkedDataText = await this.evaluateInDocument((document) => {
      return document.querySelector('head script[type="application/ld+json"]')?.innerHTML ?? '';
    });
    if (!linkedDataText) {
      throw new NewsArticleDataNotFoundError(`Linked data not found for URL ${url}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawLinkedData = JSON.parse(linkedDataText) as any;
    const linkedData = rawLinkedData[0] as WithContext<NewsArticle>;

    // Content
    const content = await this.evaluateInDocument((document) => {
      return Array.from(document.querySelectorAll('main .article-body p, #article_sector .snippet__body'))
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
