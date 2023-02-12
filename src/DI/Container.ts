import { Container } from 'inversify';
import 'reflect-metadata';

import { MongoDBService } from '../Services/MongoDBService';
import { NewsScraperDatabaseManager } from '../Services/NewsScraperDatabaseManager';
import { NewsScraperManager } from '../Services/NewsScraperManager';
import { NewsScraperMessageBroker } from '../Services/NewsScraperMessageBroker';
import { NewsScraperScheduler } from '../Services/NewsScraperScheduler';
import { NewsScraperWorker } from '../Services/NewsScraperWorker';
import { PrometheusMetricsServer } from '../Services/PrometheusMetricsServer';
import { RabbitMQService } from '../Services/RabbitMQService';
import { RedisService } from '../Services/RedisService';
import { TYPES } from './ContainerTypes';

const container = new Container({
  defaultScope: 'Singleton',
  autoBindInjectable: true,
});

container.bind<RedisService>(TYPES.RedisService).to(RedisService);
container.bind<RabbitMQService>(TYPES.RabbitMQService).to(RabbitMQService);
container.bind<MongoDBService>(TYPES.MongoDBService).to(MongoDBService);
container.bind<PrometheusMetricsServer>(TYPES.PrometheusMetricsServer).to(PrometheusMetricsServer);
container.bind<NewsScraperManager>(TYPES.NewsScraperManager).to(NewsScraperManager);
container.bind<NewsScraperScheduler>(TYPES.NewsScraperScheduler).to(NewsScraperScheduler);
container.bind<NewsScraperWorker>(TYPES.NewsScraperWorker).to(NewsScraperWorker);
container.bind<NewsScraperDatabaseManager>(TYPES.NewsScraperDatabaseManager).to(NewsScraperDatabaseManager);
container.bind<NewsScraperMessageBroker>(TYPES.NewsScraperMessageBroker).to(NewsScraperMessageBroker);

export { container };
