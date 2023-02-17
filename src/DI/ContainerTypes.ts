export const TYPES = {
  RedisService: Symbol.for('RedisService'),
  RabbitMQService: Symbol.for('RabbitMQService'),
  PrometheusMetricsServer: Symbol.for('PrometheusMetricsServer'),
  NewsScraperManager: Symbol.for('NewsScraperManager'),
  NewsScraperTaskDispatcher: Symbol.for('NewsScraperTaskDispatcher'),
  NewsScraperTaskWorker: Symbol.for('NewsScraperTaskWorker'),
  NewsScraperDatabase: Symbol.for('NewsScraperDatabase'),
  NewsScraperMessageBroker: Symbol.for('NewsScraperMessageBroker'),
};
