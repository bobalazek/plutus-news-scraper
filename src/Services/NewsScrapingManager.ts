import { readdirSync } from 'fs';
import { injectable } from 'inversify/lib/annotation/injectable';
import { join } from 'path';

import type { AbstractNewsScraper } from '../AbstractNewsScraper';
import { ROOT_DIRECTORY } from '../Constants';
import { NewsArticleWithSiteKeyInterface } from '../Types/NewsArticleInterface';
import { NewsBasicArticleWithSiteKeyInterface } from '../Types/NewsBasicArticleInterface';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';

@injectable()
export class NewsScrapingManager {
  private _scrapers: Record<string, NewsScraperInterface> = {};
  private _scrapersDomainMap: Record<string, string> = {};
  private _initialized: boolean = false;
  private _currentScraper: AbstractNewsScraper | null = null;
  private _headful: boolean = false;
  private _preventClose: boolean = false;

  async init() {
    if (this._initialized) {
      return;
    }

    const directoryFiles = readdirSync(join(ROOT_DIRECTORY, 'dist', 'Scrapers'));
    for (const scraperFileName of directoryFiles) {
      if (!scraperFileName.endsWith('.js')) {
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

  async terminateScraper() {
    await this._currentScraper?.closePuppeteerBrowser(true);
  }

  async get(newsSiteKey: string) {
    await this.init();

    return this._scrapers[newsSiteKey] ?? undefined;
  }

  async getForDomain(domain: string) {
    await this.init();

    return this.get(this._scrapersDomainMap[domain]);
  }

  async scrapeArticle(url: string): Promise<NewsArticleWithSiteKeyInterface> {
    const urlObject = new URL(url);
    const scraper = await this.getForDomain(urlObject.hostname);
    if (typeof scraper === 'undefined') {
      throw new Error(`No scraper for the domain "${urlObject.hostname}" was found`);
    }

    this._currentScraper = scraper as unknown as AbstractNewsScraper;
    this._currentScraper.setHeadful(this._headful);
    this._currentScraper.setPreventClose(this._preventClose);

    const newsArticle = await scraper.scrapeArticle({ url });
    if (!newsArticle) {
      throw new Error(`Article data not found.`);
    }

    return { ...newsArticle, url, newsSiteKey: scraper.key };
  }

  async scrapeRecentArticles(newsSiteKey: string): Promise<NewsBasicArticleWithSiteKeyInterface[]> {
    const scraper = await this.get(newsSiteKey);
    if (typeof scraper === 'undefined') {
      throw new Error(`Scraper ${newsSiteKey} was not found`);
    }

    this._currentScraper = scraper as unknown as AbstractNewsScraper;
    this._currentScraper.setHeadful(this._headful);
    this._currentScraper.setPreventClose(this._preventClose);

    if (typeof scraper.scrapeRecentArticles === 'undefined') {
      throw new Error(`This scraper (${newsSiteKey}) does not have the .getRecentArticles() method implemented`);
    }

    const recentArticles = await scraper.scrapeRecentArticles();
    if (recentArticles.length === 0) {
      throw new Error(`No recent articles found for this news site`);
    }

    return recentArticles.map((recentArticle) => {
      return {
        ...recentArticle,
        newsSiteKey: scraper.key,
      };
    });
  }

  /**
   * If this is set to true, then it will open an actual browser window
   *
   * @param value boolean
   */
  setHeadful(value: boolean) {
    this._headful = value;
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
}
