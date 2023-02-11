export class NewsArticleDataNotFoundError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message ?? 'News article data not found', options);
  }
}
