import { NewsArticleMultimediaTypeEnum } from './NewsArticleMultimediaTypeEnum';
import { NewsArticleTypeEnum } from './NewsArticleTypeEnum';
import { NewsBasicArticleInterface } from './NewsBasicArticleInterface';
import { NewsArticleProcessingStatusEnum } from './ProcessingStatusEnum';

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
  locale?: string;
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
  /*
  [
    "stock:APPL@NASDAQ",
    "company:Apple Inc.",
    "currency:USD",
    "cryptocurrency:BTC",
    "asset-class:cryptocurrency",
    "economy:USA",
    "economy:global",
  ]
  */
  relatedEntities?: string[];
  tags?: string[];
  processingStatus?: NewsArticleProcessingStatusEnum;
  processingStatusFailedMessage?: string;
}
