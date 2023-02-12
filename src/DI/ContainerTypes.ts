export const TYPES = {
  RedisService: Symbol.for('RedisService'),
  RabbitMQService: Symbol.for('RabbitMQService'),
  MongoDBService: Symbol.for('MongoDBService'),
  PrometheusMetricsServer: Symbol.for('PrometheusMetricsServer'),
  NewsScraperManager: Symbol.for('NewsScraperManager'),
  NewsScraperScheduler: Symbol.for('NewsScraperScheduler'),
  NewsScraperWorker: Symbol.for('NewsScraperWorker'),
  NewsScraperDatabaseManager: Symbol.for('NewsScraperDatabaseManager'),
  NewsScraperMessageBroker: Symbol.for('NewsScraperMessageBroker'),
};
