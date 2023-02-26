import { readdirSync } from 'fs';
import { inject, injectable } from 'inversify';
import { join } from 'path';

import { TYPES } from '../DI/ContainerTypes';
import { NewsArticlesNotFoundError } from '../Errors/NewsArticlesNotFoundError';
import { NewsArticleExtendedSchema, NewsArticleExtendedType } from '../Schemas/NewsArticleSchema';
import { NewsBasicArticleExtendedSchema, NewsBasicArticleExtendedType } from '../Schemas/NewsBasicArticleSchema';
import type { AbstractNewsScraper } from '../Scrapers/AbstractNewsScraper';
import { NewsArticleTypeEnum } from '../Types/NewsArticleTypeEnum';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';
import { ROOT_DIRECTORY } from '../Utils/Paths';
import { Logger } from './Logger';

@injectable()
export class NewsScraperManager {
  private _scrapers: Record<string, NewsScraperInterface> = {};
  private _scrapersDomainMap: Record<string, string> = {};
  private _initialized: boolean = false;
  private _currentScraper: AbstractNewsScraper | null = null;
  private _headful: boolean = false;
  private _preventClose: boolean = false;

  constructor(@inject(TYPES.Logger) private _logger: Logger) {}

  async scrapeArticle(url: string, headful?: boolean, preventClose?: boolean): Promise<NewsArticleExtendedType> {
    const startTime = performance.now();

    const scraper = await this.getForUrl(url);
    if (typeof scraper === 'undefined') {
      throw new Error(`No scraper for the URL "${url}" was found`);
    }

    this._currentScraper = this._prepareScraper(scraper, headful, preventClose);

    const newsArticle = await scraper.scrapeArticle({ url });

    const newsArticleParsed = NewsArticleExtendedSchema.parse({
      ...newsArticle,
      newsSiteKey: scraper.key,
      type: NewsArticleTypeEnum.NEWS_ARTICLE,
    });

    this._logger.debug(`Article data:`);
    this._logger.debug(newsArticleParsed);

    const endTime = performance.now();

    this._logger.trace(`scrapeArticle took ${((endTime - startTime) / 1000).toPrecision(3)}s`);

    return newsArticleParsed;
  }

  async scrapeRecentArticles(
    newsSiteKey: string,
    urls?: string[],
    headful?: boolean,
    preventClose?: boolean
  ): Promise<NewsBasicArticleExtendedType[]> {
    const startTime = performance.now();

    const scraper = await this.get(newsSiteKey);
    if (typeof scraper === 'undefined') {
      throw new Error(`Scraper ${newsSiteKey} was not found`);
    }

    this._currentScraper = this._prepareScraper(scraper, headful, preventClose);

    if (typeof scraper.scrapeRecentArticles === 'undefined') {
      throw new Error(`This scraper (${newsSiteKey}) does not have the .scrapeRecentArticles() method implemented`);
    }

    const recentArticlesRaw = await scraper.scrapeRecentArticles(urls);
    if (recentArticlesRaw.length === 0) {
      throw new NewsArticlesNotFoundError(`No recent articles found for this news site`);
    }

    const recentArticles = recentArticlesRaw.map((recentArticle) => {
      return NewsBasicArticleExtendedSchema.parse({
        ...recentArticle,
        newsSiteKey: scraper.key,
      });
    });

    const endTime = performance.now();

    this._logger.trace(`scrapeRecentArticles took ${((endTime - startTime) / 1000).toPrecision(3)}s`);

    return recentArticles;
  }

  async scrapeArchivedArticles(
    newsSiteKey: string,
    options: Record<string, string>,
    headful?: boolean,
    preventClose?: boolean
  ): Promise<NewsBasicArticleExtendedType[]> {
    const startTime = performance.now();

    const scraper = await this.get(newsSiteKey);
    if (typeof scraper === 'undefined') {
      throw new Error(`Scraper ${newsSiteKey} was not found`);
    }

    this._currentScraper = this._prepareScraper(scraper, headful, preventClose);

    if (typeof scraper.scrapeArchivedArticles === 'undefined') {
      throw new Error(`This scraper (${newsSiteKey}) does not have the .scrapeArchivedArticles() method implemented`);
    }

    const archivedArticlesRaw = await scraper.scrapeArchivedArticles(options);
    if (archivedArticlesRaw.length === 0) {
      throw new NewsArticlesNotFoundError(`No archived articles found for this news site`);
    }

    const archivedArticles = archivedArticlesRaw.map((recentArticle) => {
      return NewsBasicArticleExtendedSchema.parse({
        ...recentArticle,
        newsSiteKey: scraper.key,
      });
    });

    const endTime = performance.now();

    this._logger.trace(`scrapeArchivedArticles took ${((endTime - startTime) / 1000).toPrecision(3)}s`);

    return archivedArticles;
  }

  async terminate(force: boolean = false) {
    if (this._preventClose && !force) {
      return;
    }

    await this._currentScraper?.terminate(true);
  }

  async get(newsSiteKey: string) {
    await this._init();

    return this._scrapers[newsSiteKey] ?? undefined;
  }

  async getForUrl(url: string) {
    await this._init();

    const urlObject = new URL(url);

    return this.getForDomain(urlObject.hostname);
  }

  async getForDomain(domain: string) {
    await this._init();

    return this.get(this._scrapersDomainMap[domain]);
  }

  async getAll() {
    await this._init();

    return Object.values(this._scrapers);
  }

  private async _init(forceReinitialize: boolean = false) {
    if (this._initialized && !forceReinitialize) {
      return;
    }

    const directoryFiles = readdirSync(join(ROOT_DIRECTORY, 'Scrapers'));
    for (const scraperFileName of directoryFiles) {
      if (!scraperFileName.endsWith('.js') || scraperFileName.startsWith('Abstract')) {
        continue;
      }

      try {
        const importedModule = await import(`../Scrapers/${scraperFileName}`); // Needs to be the relative path from the transpiled .js file
        const scraperModule = new importedModule.default() as NewsScraperInterface; // or importedModule.default.default() if using the TSC compailer

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

  private _prepareScraper(scraper: NewsScraperInterface, headful?: boolean, preventClose?: boolean) {
    this._headful = headful ?? false;
    this._preventClose = preventClose ?? false;

    const newsScraper = scraper as unknown as AbstractNewsScraper;
    newsScraper.setLogger(this._logger);
    newsScraper.setPuppeteerHeadful(this._headful);
    newsScraper.setPuppeteerPreventClose(this._preventClose);

    return newsScraper;
  }
}
