/**
 * Use this to return the very basic data from the news list pages.
 * The only required propery is the url, but you can also add the title or content if you want.
 */
export interface NewsBasicArticleInterface {
  url: string;
  title?: string;
  content?: string;
}

/**
 * This is just the same basic article as above, but it also includes the newsSiteKey.
 */
export interface NewsBasicArticleWithSiteKeyInterface extends NewsBasicArticleInterface {
  newsSiteKey: string;
}
