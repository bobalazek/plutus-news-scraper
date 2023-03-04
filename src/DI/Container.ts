import { Container } from 'inversify';
import 'reflect-metadata';

import { HTTPServerService } from '../Services/HTTPServerService';
import { Logger } from '../Services/Logger';
import { NewsScraperDatabase } from '../Services/NewsScraperDatabase';
import { NewsScraperManager } from '../Services/NewsScraperManager';
import { NewsScraperMessageBroker } from '../Services/NewsScraperMessageBroker';
import { NewsScraperScrapeRunManager } from '../Services/NewsScraperScrapeRunManager';
import { NewsScraperTaskDispatcher } from '../Services/NewsScraperTaskDispatcher';
import { NewsScraperTaskWorker } from '../Services/NewsScraperTaskWorker';
import { PrometheusService } from '../Services/PrometheusService';
import { RabbitMQService } from '../Services/RabbitMQService';
import { RedisService } from '../Services/RedisService';
import { CONTAINER_TYPES } from './ContainerTypes';

const container = new Container({
  defaultScope: 'Singleton',
  autoBindInjectable: true,
});

container.bind<Logger>(CONTAINER_TYPES.Logger).to(Logger);
container.bind<RedisService>(CONTAINER_TYPES.RedisService).to(RedisService);
container.bind<RabbitMQService>(CONTAINER_TYPES.RabbitMQService).to(RabbitMQService);
container.bind<PrometheusService>(CONTAINER_TYPES.PrometheusService).to(PrometheusService);
container.bind<HTTPServerService>(CONTAINER_TYPES.HTTPServerService).to(HTTPServerService);
container.bind<NewsScraperManager>(CONTAINER_TYPES.NewsScraperManager).to(NewsScraperManager);
container.bind<NewsScraperTaskDispatcher>(CONTAINER_TYPES.NewsScraperTaskDispatcher).to(NewsScraperTaskDispatcher);
container.bind<NewsScraperTaskWorker>(CONTAINER_TYPES.NewsScraperTaskWorker).to(NewsScraperTaskWorker);
container.bind<NewsScraperDatabase>(CONTAINER_TYPES.NewsScraperDatabase).to(NewsScraperDatabase);
container.bind<NewsScraperMessageBroker>(CONTAINER_TYPES.NewsScraperMessageBroker).to(NewsScraperMessageBroker);
container
  .bind<NewsScraperScrapeRunManager>(CONTAINER_TYPES.NewsScraperScrapeRunManager)
  .to(NewsScraperScrapeRunManager);

export { container };
