export class NewsArticlesNotFoundError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message ?? 'No Articles Found', options);
  }
}
