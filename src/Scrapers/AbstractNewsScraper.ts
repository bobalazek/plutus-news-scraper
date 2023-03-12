import { JSDOM, VirtualConsole } from 'jsdom';
import { Browser, Page, PuppeteerLaunchOptions, WaitForOptions } from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

import { Logger } from '../Services/Logger';
import { PUPPETEER_EXECUTABLE_PATH } from '../Utils/Environment';

puppeteer.use(StealthPlugin());

export abstract class AbstractNewsScraper {
  public useJSDOM: boolean = false;

  protected _logger!: Logger;

  private _puppeteerBrowser?: Browser;
  private _puppteerPagesMap: Map<string, Page> = new Map();
  private _puppeteerHeadful: boolean = false;
  private _puppeteerPreventClose: boolean = false;
  private _jsdom: JSDOM | null = null;
  private _jsdomDocument: Document | null = null;
  private _jsdomUserAgent?: string;

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

      await this.setUserAgent(undefined, page);

      this._puppteerPagesMap.set(key, page);
    }

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
    const virtualConsole = new VirtualConsole();
    virtualConsole.on('error', () => {
      // Skip console errors
    });

    const dom = await JSDOM.fromURL(url, {
      userAgent: this._jsdomUserAgent,
      runScripts: 'dangerously',
      virtualConsole,
    });

    this._jsdom = dom;
    this._jsdomDocument = this._jsdom.window.document;

    return this._jsdomDocument;
  }

  /***** Helpers *****/
  async goToPage(url: string, args?: WaitForOptions): Promise<void> {
    if (this.useJSDOM) {
      await this.getJSDOMDocumentFromUrl(url);

      return;
    }

    const page = await this.getPuppeteerPage();

    await page.goto(url, args);
  }

  async evaluateInDocument<T>(callback: (document: Document) => T): Promise<Awaited<T>> {
    if (this.useJSDOM) {
      if (!this._jsdomDocument) {
        throw new Error(`You will need to call the this.goToPage() first, before being able to call this`);
      }

      return Promise.resolve(
        (async (document) => {
          return await callback(document);
        })(this._jsdomDocument)
      );
    }

    const page = await this.getPuppeteerPage();

    const documentHandle = await page.evaluateHandle(() => document);
    const callbackString = `(${callback.toString()})(document)`;
    const resultHandle = await page.evaluateHandle(callbackString, documentHandle);
    const result = await resultHandle.jsonValue();
    await resultHandle.dispose();
    await documentHandle.dispose();

    return result as Awaited<T>;
  }

  async clickOnPage(selector: string): Promise<void> {
    if (this.useJSDOM) {
      if (!this._jsdomDocument) {
        throw new Error(`You will need to call the this.goToPage() first, before being able to call this`);
      }

      const event = new Event('click', { bubbles: false, cancelable: false, composed: false });
      const element = this._jsdomDocument.querySelector(selector);
      if (!element) {
        throw new Error(`Click element not found`);
      }

      element.dispatchEvent(event);

      return;
    }

    const page = await this.getPuppeteerPage();

    return page.click(selector);
  }

  async waitForSelectorOnPage(selector: string): Promise<void> {
    if (this.useJSDOM) {
      if (!this._jsdomDocument) {
        throw new Error(`You will need to call the this.goToPage() first, before being able to call this`);
      }

      return;
    }

    const page = await this.getPuppeteerPage();

    await page.waitForSelector(selector);
  }

  /**
   * @param userAgent if set to null, it will set it to the default string provided
   */
  async setUserAgent(userAgent?: string, page?: Page) {
    if (!userAgent) {
      userAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36';
    }

    if (this.useJSDOM) {
      this._jsdomUserAgent = userAgent;

      return;
    }

    if (!page) {
      // We need to do this, because this method is immediatly called in getPuppeteerPage(), otherwise we will have a recursive loop
      throw new Error(`You need to provide the page argument if you are setting the user agent`);
    }

    await page.setUserAgent(userAgent);

    return page;
  }

  setLogger(logger: Logger) {
    this._logger = logger;

    return this;
  }

  async terminate(force: boolean = false) {
    if (this.useJSDOM) {
      this._jsdom?.window?.close();
    }

    if (this._puppeteerPreventClose && !force) {
      return;
    }

    await this._puppeteerBrowser?.close();

    this._puppeteerBrowser = undefined;
    this._puppteerPagesMap.clear();
  }
}
