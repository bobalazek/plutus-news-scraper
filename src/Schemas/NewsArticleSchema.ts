import { z } from 'zod';

import { NewsArticleMultimediaTypeEnum } from '../Types/NewsArticleMultimediaTypeEnum';

export const NewsArticleAuthorSchema = z.object({
  name: z.string(),
  url: z.string().optional(),
});

export const NewsArticleCategorySchema = z.object({
  name: z.string(),
  url: z.string().optional(),
});

export const NewsArticleSchema = z.object({
  title: z.string(),
  multimediaType: z.nativeEnum(NewsArticleMultimediaTypeEnum),
  content: z.string(),
  newsSiteArticleId: z.string(),
  authors: z.array(NewsArticleAuthorSchema).optional(),
  categories: z.array(NewsArticleCategorySchema).optional(),
  imageUrl: z.string().optional(),
  languageCode: z.string(),
  publishedAt: z.date(),
  modifiedAt: z.date(),
});
