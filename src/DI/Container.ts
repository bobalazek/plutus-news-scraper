import { Container } from 'inversify';
import 'reflect-metadata';

import { NewsScraperManager } from '../Services/NewsScraperManager';
import { NewsScraperScheduler } from '../Services/NewsScraperScheduler';
import { NewsScraperWorker } from '../Services/NewsScraperWorker';
import { RabbitMQService } from '../Services/RabbitMQService';
import { RedisService } from '../Services/RedisService';
import { TYPES } from './ContainerTypes';

const container = new Container({
  defaultScope: 'Singleton',
  autoBindInjectable: true,
});

container.bind<NewsScraperManager>(TYPES.NewsScraperManager).to(NewsScraperManager);
container.bind<NewsScraperScheduler>(TYPES.NewsScraperScheduler).to(NewsScraperScheduler);
container.bind<NewsScraperWorker>(TYPES.NewsScraperWorker).to(NewsScraperWorker);
container.bind<RedisService>(TYPES.RedisService).to(RedisService);
container.bind<RabbitMQService>(TYPES.RabbitMQService).to(RabbitMQService);

export { container };