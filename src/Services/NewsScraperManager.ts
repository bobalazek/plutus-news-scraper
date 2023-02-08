import { retry } from '@lifeomic/attempt';
import { readdirSync } from 'fs';
import { injectable } from 'inversify';
import { join } from 'path';

import { NewsArticleNotFoundError } from '../Errors/NewsArticleNotFoundError';
import { NewsArticlesNotFoundError } from '../Errors/NewsArticlesNotFoundError';
import type { AbstractNewsScraper } from '../Scrapers/AbstractNewsScraper';
import { NewsArticleExtendedInterface } from '../Types/NewsArticleInterface';
import { NewsArticleTypeEnum } from '../Types/NewsArticleTypeEnum';
import { NewsBasicArticleExtendedInterface } from '../Types/NewsBasicArticleInterface';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';
import { ROOT_DIRECTORY } from '../Utils/Constants';

@injectable()
export class NewsScraperManager {
  private _scrapers: Record<string, NewsScraperInterface> = {};
  private _scrapersDomainMap: Record<string, string> = {};
  private _initialized: boolean = false;
  private _currentScraper: AbstractNewsScraper | null = null;
  private _headful: boolean = false;
  private _preventClose: boolean = false;

  async terminateScraper() {
    if (this._preventClose) {
      return;
    }

    await this._currentScraper?.closePuppeteerBrowser(true);
  }

  async get(newsSiteKey: string) {
    await this._init();

    return this._scrapers[newsSiteKey] ?? undefined;
  }

  async getForDomain(domain: string) {
    await this._init();

    return this.get(this._scrapersDomainMap[domain]);
  }

  async getAll() {
    await this._init();

    return Object.values(this._scrapers);
  }

  async scrapeArticle(url: string): Promise<NewsArticleExtendedInterface> {
    const urlObject = new URL(url);
    const scraper = await this.getForDomain(urlObject.hostname);
    if (typeof scraper === 'undefined') {
      throw new Error(`No scraper for the domain "${urlObject.hostname}" was found`);
    }

    this._currentScraper = this._prepareScraper(scraper);

    // TODO: implement IP change after each retry?
    const newsArticle = await retry(
      async () => {
        return scraper.scrapeArticle({ url });
      },
      {
        delay: 500,
        factor: 2,
        maxAttempts: 3,
      }
    );
    if (!newsArticle) {
      throw new NewsArticleNotFoundError(`Article data not found.`);
    }

    return { ...newsArticle, url, newsSiteKey: scraper.key, type: NewsArticleTypeEnum.NEWS_ARTICLE };
  }

  async scrapeRecentArticles(newsSiteKey: string, urls?: string[]): Promise<NewsBasicArticleExtendedInterface[]> {
    const scraper = await this.get(newsSiteKey);
    if (typeof scraper === 'undefined') {
      throw new Error(`Scraper ${newsSiteKey} was not found`);
    }

    this._currentScraper = this._prepareScraper(scraper);

    if (typeof scraper.scrapeRecentArticles === 'undefined') {
      throw new Error(`This scraper (${newsSiteKey}) does not have the .scrapeRecentArticles() method implemented`);
    }

    // TODO: implement IP change after each retry?
    const recentArticles = await retry(
      async () => {
        return scraper.scrapeRecentArticles(urls);
      },
      {
        delay: 500,
        factor: 2,
        maxAttempts: 3,
      }
    );
    if (recentArticles.length === 0) {
      throw new NewsArticlesNotFoundError(`No recent articles found for this news site`);
    }

    return recentArticles.map((recentArticle) => {
      return {
        ...recentArticle,
        newsSiteKey: scraper.key,
      };
    });
  }

  async scrapeArchivedArticles(
    newsSiteKey: string,
    options: Record<string, string>
  ): Promise<NewsBasicArticleExtendedInterface[]> {
    const scraper = await this.get(newsSiteKey);
    if (typeof scraper === 'undefined') {
      throw new Error(`Scraper ${newsSiteKey} was not found`);
    }

    this._currentScraper = this._prepareScraper(scraper);

    if (typeof scraper.scrapeArchivedArticles === 'undefined') {
      throw new Error(`This scraper (${newsSiteKey}) does not have the .scrapeArchivedArticles() method implemented`);
    }

    // TODO: implement IP change after each retry?
    const archivedArticles = await retry(
      async () => {
        return scraper.scrapeArchivedArticles(options);
      },
      {
        delay: 500,
        factor: 2,
        maxAttempts: 3,
      }
    );
    if (archivedArticles.length === 0) {
      throw new NewsArticlesNotFoundError(`No archived articles found for this news site`);
    }

    return archivedArticles.map((recentArticle) => {
      return {
        ...recentArticle,
        newsSiteKey: scraper.key,
      };
    });
  }

  /**
   * ========== Helpers ==========
   */
  /**
   * If this is set to true, then it will open an actual browser window
   *
   * @param value boolean
   */
  setHeadful(value: boolean) {
    this._headful = value;

    return this;
  }

  /**
   * Set if we should prevent the closing/termination of the browser at the end or not?
   *
   * @param value boolean
   */
  setPreventClose(value: boolean) {
    this._preventClose = value;

    return this;
  }

  /**
   * ========== Private ==========
   */
  private async _init() {
    if (this._initialized) {
      return;
    }

    const directoryFiles = readdirSync(join(ROOT_DIRECTORY, '..', 'dist', 'Scrapers'));
    for (const scraperFileName of directoryFiles) {
      if (!scraperFileName.endsWith('.js') || scraperFileName.startsWith('Abstract')) {
        continue;
      }

      try {
        const importedModule = await import(`../Scrapers/${scraperFileName}`); // Needs to be the relative path from the transpiled .js file
        const scraperModule = new importedModule.default.default() as NewsScraperInterface;

        if (!scraperModule.domain) {
          throw new Error(`Domain not set for the scraper ${scraperFileName}`);
        }

        if (!scraperModule.scrapeArticle) {
          throw new Error(`Scraper ${scraperFileName} is missing the processArticle() method`);
        }

        if (typeof this._scrapers[scraperModule.domain] !== 'undefined') {
          throw new Error(
            `Scraper with domain ${scraperModule.domain} already exists - duplicate found in the "${scraperFileName}" file`
          );
        }

        this._scrapers[scraperModule.key] = scraperModule;

        this._scrapersDomainMap[scraperModule.domain] = scraperModule.key;

        if (Array.isArray(scraperModule.domainAliases)) {
          for (const domainAlias of scraperModule.domainAliases) {
            if (typeof this._scrapers[domainAlias] !== 'undefined') {
              throw new Error(
                `Scraper with domain ${domainAlias} already exists - duplicate found in the "${scraperFileName}" file`
              );
            }

            this._scrapersDomainMap[domainAlias] = scraperModule.key;
          }
        }
      } catch (err) {
        throw new Error(`Error: ${err}`);
      }
    }

    this._initialized = true;
  }

  private _prepareScraper(scraper: NewsScraperInterface) {
    const newsScraper = scraper as unknown as AbstractNewsScraper;
    newsScraper.setHeadful(this._headful);
    newsScraper.setPreventClose(this._preventClose);

    return newsScraper;
  }
}
