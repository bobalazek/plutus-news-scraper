export const TYPES = {
  RedisService: Symbol.for('RedisService'),
  RabbitMQService: Symbol.for('RabbitMQService'),
  HTTPServer: Symbol.for('HTTPServer'),
  NewsScraperManager: Symbol.for('NewsScraperManager'),
  NewsScraperTaskDispatcher: Symbol.for('NewsScraperTaskDispatcher'),
  NewsScraperTaskWorker: Symbol.for('NewsScraperTaskWorker'),
  NewsScraperDatabase: Symbol.for('NewsScraperDatabase'),
  NewsScraperMessageBroker: Symbol.for('NewsScraperMessageBroker'),
};
