import { convert } from 'html-to-text';

import { NewsArticleType } from '../Schemas/NewsArticleSchema';
import { NewsBasicArticleType } from '../Schemas/NewsBasicArticleSchema';
import { NewsArticleMultimediaTypeEnum } from '../Types/NewsArticleMultimediaTypeEnum';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';
import { sleep } from '../Utils/Helpers';
import { AbstractNewsScraper } from './AbstractNewsScraper';

export default class CNBCNewsScraper extends AbstractNewsScraper implements NewsScraperInterface {
  key: string = 'cnbc';
  domain: string = 'www.cnbc.com';
  recentArticleListUrls: string[] = [
    'https://www.cnbc.com/business/',
    'https://www.cnbc.com/investing/',
    'https://www.cnbc.com/technology/',
    'https://www.cnbc.com/politics/',
  ];

  async scrapeRecentArticles(urls?: string[]): Promise<NewsBasicArticleType[]> {
    const basicArticles: NewsBasicArticleType[] = [];
    const recentArticleListUrls = Array.isArray(urls) ? urls : this.recentArticleListUrls;

    this._logger.info(`Starting to scrape the recent articles on CNBC ...`);

    for (const recentArticleListUrl of recentArticleListUrls) {
      this._logger.info(`Going to URL ${recentArticleListUrl} ...`);

      await sleep(1000);
      await this.goToPage(recentArticleListUrl, {
        waitUntil: 'domcontentloaded',
      });

      const articleUrls = this.getUniqueArray(
        await this.evaluateInDocument(() => {
          // Get all the possible (anchor) elements that have the links to articles
          const querySelector = ['.Card-textContent a.Card-title'].join(', ');

          // Fetch those with the .querySelectoAll() and convert it to an array
          const $elements = Array.from(document.querySelectorAll(querySelector));

          // Loop/map through those elements and get the href artibute
          return $elements.map(($el) => {
            return $el.getAttribute('href') ?? ''; // Needs to have a '' (empty string) as a fallback, because otherwise it could be null, which we don't want
          });
        })
      ).filter((href) => {
        return href !== ''; // Now we want to filter out any links that are '', just in case
      });

      this._logger.info(`Found ${articleUrls.length} articles on this page`);

      for (const articleUrl of articleUrls) {
        const url = this._preProcessUrl(articleUrl);

        this._logger.debug(`Article URL: ${url}`);

        basicArticles.push({
          // We are actually pushing a basic article object, instead of just URL,
          // if in the future we for example maybe want to provide some more metadata
          // on the list (recent  and archived articles) scrape
          url: url,
        });
      }
    }

    return Promise.resolve(this.getUniqueArray(basicArticles));
  }

  async scrapeArticle(basicArticle: NewsBasicArticleType): Promise<NewsArticleType> {
    const url = this._preProcessUrl(basicArticle.url);

    this._logger.info(`Going to URL ${url} ...`);

    await this.goToPage(url, {
      waitUntil: 'networkidle2',
    });

    const newsSiteArticleId = await this.evaluateInDocument(() => {
      return document.querySelector('head meta[property="pageNodeId"]')?.getAttribute('content') ?? '';
    });
    const datePublished = await this.evaluateInDocument(() => {
      return document.querySelector('head meta[itemprop="dateCreated"]')?.getAttribute('content') ?? '';
    });
    const dateModified = await this.evaluateInDocument(() => {
      return document.querySelector('head meta[itemprop="dateModified"]')?.getAttribute('content') ?? '';
    });
    const title = await this.evaluateInDocument(() => {
      return document.querySelector('head meta[property="og:title"]')?.getAttribute('content') ?? '';
    });
    const authorName = await this.evaluateInDocument(() => {
      return document.querySelector('meta[name="author"]')?.getAttribute('content') ?? '';
    });
    const authorUrl = await this.evaluateInDocument(() => {
      return (
        document
          .querySelector(['.ArticleHeader-author .Author-authorNameAndSocial a.Author-authorName'].join(', '))
          ?.getAttribute('href') ?? ''
      );
    });

    //TODO categories appear empty
    const categories = await this.evaluateInDocument(() => {
      return Array.from(
        document.querySelectorAll(
          ['.ArticleHeader-headerContentContainer .ArticleHeader-wrapper a.articleHeader-eyebrow'].join(', ')
        )
      ).map(($a) => {
        return {
          name: $a.innerHTML ?? '',
          url: $a.getAttribute('href') ?? undefined,
        };
      });
    });
    const imageUrl = await this.evaluateInDocument(() => {
      return document.querySelector('head meta[property="og:image"]')?.getAttribute('content') ?? '';
    });

    const languageCode = await this.evaluateInDocument(() => {
      return document.querySelector('html')?.getAttribute('lang') ?? '';
    });

    // Content
    const content = await this.evaluateInDocument(() => {
      return Array.from(document.querySelectorAll('.PageBuilder-article .ArticleBody-articleBody'))
        .map((element) => {
          return element.innerHTML;
        })
        .join('');
    });

    const article: NewsArticleType = {
      url: url,
      title: title,
      multimediaType: NewsArticleMultimediaTypeEnum.TEXT,
      content: convert(content, {
        wordwrap: false,
      }),
      newsSiteArticleId: newsSiteArticleId,
      publishedAt: new Date(datePublished),
      modifiedAt: new Date(dateModified),
      authors: [{ name: authorName, url: authorUrl }],
      categories: categories,
      imageUrl: imageUrl,
      languageCode: languageCode,
    };

    return Promise.resolve(article);
  }

  private _preProcessUrl(url: string): string {
    const urlObject = new URL(url);

    return url.replace(urlObject.search, '').replace(urlObject.hash, '');
  }
}
