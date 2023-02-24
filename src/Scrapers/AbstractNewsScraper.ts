import puppeteer, { Browser, Page, PuppeteerLaunchOptions } from 'puppeteer';

import { Logger } from '../Services/Logger';
import { PUPPETEER_EXECUTABLE_PATH } from '../Utils/Environment';

export abstract class AbstractNewsScraper {
  protected _logger!: Logger;
  private _puppeteerBrowser?: Browser;
  private _puppteerPage?: Page;
  private _puppeteerHeadful: boolean = false;
  private _puppeteerPreventClose: boolean = false;

  async getPuppeteerBrowser(options?: PuppeteerLaunchOptions) {
    if (!this._puppeteerBrowser) {
      this._puppeteerBrowser = await puppeteer.launch({
        defaultViewport: null,
        headless: !this._puppeteerHeadful,
        executablePath: PUPPETEER_EXECUTABLE_PATH || undefined,
        ...options,
      });
    }

    return this._puppeteerBrowser;
  }

  async getPuppeteerPage(options?: PuppeteerLaunchOptions) {
    if (!this._puppteerPage) {
      const browser = await this.getPuppeteerBrowser(options);

      this._puppteerPage = await browser.newPage();

      await this.setPuppeteerUserAgent();
    }

    return this._puppteerPage;
  }

  /**
   * @param userAgent if set to null, it will set it to the default string provided
   */
  async setPuppeteerUserAgent(userAgent?: string | null) {
    if (!userAgent) {
      userAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36';
    }

    const page = await this.getPuppeteerPage();

    await page.setUserAgent(userAgent as string);

    return page;
  }

  async closePuppeteerBrowser(force: boolean = false) {
    if (this._puppeteerPreventClose && !force) {
      return;
    }

    await this._puppeteerBrowser?.close();

    this._puppeteerBrowser = undefined;
    this._puppteerPage = undefined;
  }

  getUniqueArray<T>(array: T[]) {
    return [...new Set<T>(array)];
  }

  setLogger(logger: Logger) {
    this._logger = logger;

    return this;
  }

  /**
   * If this is set to true, then it will open an actual browser window
   *
   * @param value boolean
   */
  setPuppeteerHeadful(value: boolean) {
    this._puppeteerHeadful = value;

    return this;
  }

  /**
   * Set if we should prevent the closing/termination of the browser at the end or not?
   *
   * @param value boolean
   */
  setPuppeteerPreventClose(value: boolean) {
    this._puppeteerPreventClose = value;

    return this;
  }
}
