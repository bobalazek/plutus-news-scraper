import puppeteer, { Browser, PuppeteerLaunchOptions } from 'puppeteer';

export abstract class AbstractNewsScraper {
  private _browser: Browser;
  private _headful: boolean = false;
  private _preventClose: boolean = false;

  async getPuppeteerBrowser(options?: PuppeteerLaunchOptions) {
    this._browser = await puppeteer.launch({ defaultViewport: null, headless: !this._headful, ...options });

    return this._browser;
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

  getDefaultUserAgent() {
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36';
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
