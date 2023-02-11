export class NewsArticlesNotFoundError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message ?? 'News articles not found', options);
  }
}
