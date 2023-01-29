import puppeteer, { PuppeteerLaunchOptions } from 'puppeteer';

export abstract class AbstractNewsScraper {
  getPuppeteerBrowser(options?: PuppeteerLaunchOptions) {
    return puppeteer.launch(options);
  }
}
