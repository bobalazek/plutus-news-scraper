import { z } from 'zod';

import { NewsArticleMultimediaTypeEnum } from '../Types/NewsArticleMultimediaTypeEnum';
import { NewsArticleTypeEnum } from '../Types/NewsArticleTypeEnum';
import { ProcessingStatusEnum } from '../Types/ProcessingStatusEnum';
import { NewsBasicArticleSchema } from './NewsBasicArticleSchema';

export const NewsArticleAuthorSchema = z.object({
  name: z.string(),
  url: z.string().optional(),
});
export type NewsArticleAuthorType = z.infer<typeof NewsArticleAuthorSchema>;

export const NewsArticleCategorySchema = z.object({
  name: z.string(),
  url: z.string().optional(),
});
export type NewsArticleCategoryType = z.infer<typeof NewsArticleCategorySchema>;

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
export const NewsArticleEntitySchema = z.object({
  type: z.string(),
  value: z.string(), // APPL@NASDAQ, Apple Inc., USD, BTC
  sentiment: z.number().min(-1).max(1).optional(), // What is the sentiment towards this entity in this article?
});
export type NewsArticleEntityType = z.infer<typeof NewsArticleEntitySchema>;

/**
 * This is the schema for our news scraper.
 */
export const NewsArticleSchema = NewsBasicArticleSchema.extend({
  title: z.string(),
  multimediaType: z.nativeEnum(NewsArticleMultimediaTypeEnum),
  content: z.string(),
  newsSiteArticleId: z.string(),
  authors: z.array(NewsArticleAuthorSchema).optional(),
  categories: z.array(NewsArticleCategorySchema).optional(),
  imageUrl: z.string().optional(),
  languageCode: z.string().optional(),
  publishedAt: z.date(),
  modifiedAt: z.date(),
});
export type NewsArticleType = z.infer<typeof NewsArticleSchema>;

/**
 * This schema would mostly be used when we are persisting that data somewhere like
 * into a file or into the database.
 */
export const NewsArticleExtendedSchema = NewsArticleSchema.extend({
  type: z.nativeEnum(NewsArticleTypeEnum),
  newsSiteKey: z.string(),
  entities: z.array(NewsArticleCategorySchema).optional(),
  tags: z.array(z.string()).optional(),
  processingStatus: z.nativeEnum(ProcessingStatusEnum).optional(),
  processingFailedMessage: z.string().optional(),
  processingStartedAt: z.date().optional(),
  processingFailedAt: z.date().optional(),
  processedAt: z.date().optional(),
});
export type NewsArticleExtendedType = z.infer<typeof NewsArticleExtendedSchema>;
