import { NewsArticleMultimediaTypeEnum } from './NewsArticleMultimediaTypeEnum';
import { NewsArticleTypeEnum } from './NewsArticleTypeEnum';
import { NewsBasicArticleInterface } from './NewsBasicArticleInterface';
import { ProcessingStatusEnum } from './ProcessingStatusEnum';

/**
 * This is the interface for our news scraper.
 */
export interface NewsArticleInterface extends NewsBasicArticleInterface {
  title: string;
  multimediaType: NewsArticleMultimediaTypeEnum;
  content: string;
  newsSiteArticleId: string;
  authorName?: string;
  authorUrl?: string;
  categoryName?: string;
  categoryUrl?: string;
  imageUrl?: string;
  languageCode?: string; // ISO 639-1 (2 characters)
  countryCode?: string; // ISO 3166 (2 characters)
  localeCode?: string; // Locale ID (LCID); ex.: en-us, en-gb, ...
  publishedAt: Date;
  modifiedAt: Date;
}

/**
 * This interface would mostly be used when we are persisting that data somewhere like
 * into a file or into the database.
 */
export interface NewsArticleExtendedInterface extends NewsArticleInterface {
  type: NewsArticleTypeEnum;
  newsSiteKey: string;
  relatedEntities?: string[]; // [ { type: "stock", value: "APPL@NASDAQ" }, { type: "company", value: "Apple Inc." }, { type: "currency", value: "USD" }, { type: "cryptocurrency", value: "BTC" } ]
  tags?: string[];
  metadata?: Record<string, string>; // { locale: "en_US", countryCode: "global" (or ISO 3166 countryCode) }
  processingStatus?: ProcessingStatusEnum;
  processingFailedMessage?: string;
  processingStartedAt?: Date;
  processingFailedAt?: Date;
  processedAt?: Date;
}
