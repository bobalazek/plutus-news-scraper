import { NewsArticleMultimediaTypeEnum } from './NewsArticleMultimediaTypeEnum';
import { NewsArticleTypeEnum } from './NewsArticleTypeEnum';
import { NewsBasicArticleInterface } from './NewsBasicArticleInterface';
import { ProcessingStatusEnum } from './ProcessingStatusEnum';

export interface NewsArticleAuthorInterface {
  name: string;
  url?: string;
}

export interface NewsArticleCategoryInterface {
  name: string;
  url?: string;
}

export interface NewsArticleEntityInterface {
  type: 'stock' | 'company' | 'currency' | 'cryptocurrency' | 'person'; // TODO: get all the possible. Look at NER (Named Entity Recognition) - maybe we'll rather just have one value like "stock:APPL@NASDAQ"
  value: string; // APPL@NASDAQ, Apple Inc., USD, BTC
  sentiment?: number; // What is the sentiment towards this entity in this article?
}

/**
 * This is the interface for our news scraper.
 */
export interface NewsArticleInterface extends NewsBasicArticleInterface {
  title: string;
  multimediaType: NewsArticleMultimediaTypeEnum;
  content: string;
  newsSiteArticleId: string;
  authors?: NewsArticleAuthorInterface[];
  categories?: NewsArticleCategoryInterface[];
  imageUrl?: string;
  languageCode?: string; // Which language is the article written? In ISO 639-1 (2 characters)
  countryCode?: string; // The country of the publisher in ISO 3166 (2 characters)
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
  entities?: NewsArticleEntityInterface[];
  tags?: string[];
  processingStatus?: ProcessingStatusEnum;
  processingFailedMessage?: string;
  processingStartedAt?: Date;
  processingFailedAt?: Date;
  processedAt?: Date;
}
