import { readdirSync } from 'fs';
import { join } from 'path';

import { ROOT_DIRECTORY } from './Constants';
import {
  NewsArticleWithSiteKeyInterface,
  NewsBasicArticleWithSiteKeyInterface,
  NewsScraperInterface,
} from './Types/Interfaces';

export class NewsScrapingManager {
  private _scrapers: Record<string, NewsScraperInterface> = {};
  private _scrapersDomainMap: Record<string, string> = {};
  private _initialized: boolean = false;

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
        const importedModule = await import(`./Scrapers/${scraperFileName}`);
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

  async get(newsSiteKey: string) {
    await this.init();

    return this._scrapers[newsSiteKey] ?? undefined;
  }

  async getForDomain(domain: string) {
    await this.init();

    return this._scrapers[this._scrapersDomainMap[domain]] ?? undefined;
  }

  async scrapeArticle(url: string): Promise<NewsArticleWithSiteKeyInterface> {
    const urlObject = new URL(url);
    const scraper = await this.getForDomain(urlObject.hostname);
    if (typeof scraper === 'undefined') {
      throw new Error(`No scraper for the domain "${urlObject.hostname}" was found`);
    }

    const processedArticleUrl = scraper.preProcessUrl?.(url) ?? url;

    const newsArticle = await scraper.scrapeArticle({ url: processedArticleUrl });
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
}
