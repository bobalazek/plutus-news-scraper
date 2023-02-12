export const TYPES = {
  RedisService: Symbol.for('RedisService'),
  RabbitMQService: Symbol.for('RabbitMQService'),
  MongoDBService: Symbol.for('MongoDBService'),
  PrometheusMetricsServer: Symbol.for('PrometheusMetricsServer'),
  NewsScraperManager: Symbol.for('NewsScraperManager'),
  NewsScraperTaskDispatcher: Symbol.for('NewsScraperTaskDispatcher'),
  NewsScraperTaskWorker: Symbol.for('NewsScraperTaskWorker'),
  NewsScraperDatabaseManager: Symbol.for('NewsScraperDatabaseManager'),
  NewsScraperMessageBroker: Symbol.for('NewsScraperMessageBroker'),
};
