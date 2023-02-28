import { JSDOM } from 'jsdom';
import puppeteer, { Browser, Page, PuppeteerLaunchOptions, WaitForOptions } from 'puppeteer';

import { Logger } from '../Services/Logger';
import { PUPPETEER_EXECUTABLE_PATH } from '../Utils/Environment';

export abstract class AbstractNewsScraper {
  protected _logger!: Logger;
  private _puppeteerBrowser?: Browser;
  private _puppteerPagesMap: Map<string, Page> = new Map();
  private _puppeteerHeadful: boolean = false;
  private _puppeteerPreventClose: boolean = false;

  /***** Puppeteer ******/
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

  async getPuppeteerPage(key: string = 'default', options?: PuppeteerLaunchOptions) {
    let page = this._puppteerPagesMap.get(key);
    if (!page) {
      const browser = await this.getPuppeteerBrowser(options);

      page = await browser.newPage();

      await this.setPuppeteerUserAgent(page);

      this._puppteerPagesMap.set(key, page);
    }

    return page;
  }

  /**
   * @param page
   * @param userAgent if set to null, it will set it to the default string provided
   */
  async setPuppeteerUserAgent(page: Page, userAgent?: string | null) {
    if (!userAgent) {
      userAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36';
    }

    await page.setUserAgent(userAgent as string);

    return page;
  }

  getPuppeteerPagesMap() {
    return this._puppteerPagesMap;
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

  /***** JSDom *****/
  async getJSDOMDocumentFromUrl(url: string) {
    const dom = await JSDOM.fromURL(url);

    return dom.window.document;
  }

  /***** Helpers *****/
  async goToPage(url: string, args?: WaitForOptions) {
    const page = await this.getPuppeteerPage();

    return page.goto(url, args);
  }

  async evaluateInDocument<T>(callback: (document?: Document) => T) {
    const page = await this.getPuppeteerPage();

    return page.evaluate(callback);
  }

  async clickOnPage(selector: string) {
    const page = await this.getPuppeteerPage();

    return page.click(selector);
  }

  async waitForSelectorOnPage(selector: string) {
    const page = await this.getPuppeteerPage();

    return page.waitForSelector(selector);
  }

  getUniqueArray<T>(array: T[]) {
    return [...new Set<T>(array)];
  }

  setLogger(logger: Logger) {
    this._logger = logger;

    return this;
  }

  async terminate(force: boolean = false) {
    if (this._puppeteerPreventClose && !force) {
      return;
    }

    await this._puppeteerBrowser?.close();

    this._puppeteerBrowser = undefined;
    this._puppteerPagesMap.clear();
  }
}
