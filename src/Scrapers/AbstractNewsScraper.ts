import puppeteer, { Browser, Page, PuppeteerLaunchOptions } from 'puppeteer';

import { PUPPETEER_EXECUTABLE_PATH } from '../Utils/Constants';

export abstract class AbstractNewsScraper {
  private _browser: Browser;
  private _page: Page;
  private _headful: boolean = false;
  private _preventClose: boolean = false;

  async getPuppeteerBrowser(options?: PuppeteerLaunchOptions) {
    if (!this._browser) {
      this._browser = await puppeteer.launch({
        defaultViewport: null,
        headless: !this._headful,
        executablePath: PUPPETEER_EXECUTABLE_PATH,
        ...options,
      });
    }

    return this._browser;
  }

  async getPuppeteerPage(options?: PuppeteerLaunchOptions) {
    if (!this._page) {
      const browser = await this.getPuppeteerBrowser(options);

      this._page = await browser.newPage();

      await this.setUserAgent();
    }

    return this._page;
  }

  /**
   * @param userAgent if set to null, it will set it to the default string provided
   */
  async setUserAgent(userAgent: string = null) {
    if (userAgent === null) {
      userAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36';
    }

    const page = await this.getPuppeteerPage();

    await page.setUserAgent(userAgent);

    return page;
  }

  async closePuppeteerBrowser(force: boolean = false) {
    if (this._preventClose && !force) {
      return;
    }

    await this._browser?.close();
  }

  getUniqueArray<T>(array: T[]) {
    return [...new Set<T>(array)];
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
  }
}
