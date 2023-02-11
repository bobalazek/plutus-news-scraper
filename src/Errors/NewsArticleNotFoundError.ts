export class NewsArticleNotFoundError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message ?? 'News article not found', options);
  }
}
