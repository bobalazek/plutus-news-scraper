import { z } from 'zod';

/**
 * Use this to return the very basic data from the news list pages.
 * The only required propery is the url, but you can also add the title or content if you want.
 */
export const NewsBasicArticleSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  content: z.string().optional(),
});
export type NewsBasicArticleType = z.infer<typeof NewsBasicArticleSchema>;

export const NewsBasicArticleExtendedSchema = NewsBasicArticleSchema.extend({
  newsSiteKey: z.string(),
});
export type NewsBasicArticleExtendedType = z.infer<typeof NewsBasicArticleExtendedSchema>;
