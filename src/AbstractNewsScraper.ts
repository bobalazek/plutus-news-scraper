import puppeteer, { PuppeteerLaunchOptions } from 'puppeteer';

export abstract class AbstractNewsScraper {
  getPuppeteerBrowser(options?: PuppeteerLaunchOptions) {
    return puppeteer.launch(options);
  }

  getUniqueArray<T>(array: T[]) {
    return [...new Set<T>(array)];
  }

  getDefaultUserAgent() {
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36';
  }
}
