export class NewsArticleNotFoundError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message ?? 'No Article Found', options);
  }
}
