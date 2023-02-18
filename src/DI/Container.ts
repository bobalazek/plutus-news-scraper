import { Container } from 'inversify';
import 'reflect-metadata';

import { HTTPServer } from '../Services/HTTPServer';
import { NewsScraperDatabase } from '../Services/NewsScraperDatabase';
import { NewsScraperManager } from '../Services/NewsScraperManager';
import { NewsScraperMessageBroker } from '../Services/NewsScraperMessageBroker';
import { NewsScraperTaskDispatcher } from '../Services/NewsScraperTaskDispatcher';
import { NewsScraperTaskWorker } from '../Services/NewsScraperTaskWorker';
import { RabbitMQService } from '../Services/RabbitMQService';
import { RedisService } from '../Services/RedisService';
import { TYPES } from './ContainerTypes';

const container = new Container({
  defaultScope: 'Singleton',
  autoBindInjectable: true,
});

container.bind<RedisService>(TYPES.RedisService).to(RedisService);
container.bind<RabbitMQService>(TYPES.RabbitMQService).to(RabbitMQService);
container.bind<HTTPServer>(TYPES.HTTPServer).to(HTTPServer);
container.bind<NewsScraperManager>(TYPES.NewsScraperManager).to(NewsScraperManager);
container.bind<NewsScraperTaskDispatcher>(TYPES.NewsScraperTaskDispatcher).to(NewsScraperTaskDispatcher);
container.bind<NewsScraperTaskWorker>(TYPES.NewsScraperTaskWorker).to(NewsScraperTaskWorker);
container.bind<NewsScraperDatabase>(TYPES.NewsScraperDatabase).to(NewsScraperDatabase);
container.bind<NewsScraperMessageBroker>(TYPES.NewsScraperMessageBroker).to(NewsScraperMessageBroker);

export { container };
