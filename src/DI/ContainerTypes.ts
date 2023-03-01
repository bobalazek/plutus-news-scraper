export const CONTAINER_TYPES = {
  Logger: Symbol.for('Logger'),
  RedisService: Symbol.for('RedisService'),
  RabbitMQService: Symbol.for('RabbitMQService'),
  PrometheusService: Symbol.for('PrometheusService'),
  HTTPServerService: Symbol.for('HTTPServerService'),
  NewsScraperManager: Symbol.for('NewsScraperManager'),
  NewsScraperTaskDispatcher: Symbol.for('NewsScraperTaskDispatcher'),
  NewsScraperTaskWorker: Symbol.for('NewsScraperTaskWorker'),
  NewsScraperDatabase: Symbol.for('NewsScraperDatabase'),
  NewsScraperMessageBroker: Symbol.for('NewsScraperMessageBroker'),
};
