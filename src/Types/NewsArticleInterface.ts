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

/**
 * We will need to use a Named Entity Recognition library like:
 * https://spacy.io
 * https://huggingface.co/flair/ner-english-ontonotes-large
 * https://huggingface.co/dslim/bert-base-NER
 *
 * Or we could use a GPT for that (https://nlpcloud.com/effectively-using-gpt-j-gpt-neo-gpt-3-alternatives-few-shot-learning.html) like:
 * GPT-3
 * GPT-J
 * GPT-NeoX
 **/
export interface NewsArticleEntityInterface {
  type: string;
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
