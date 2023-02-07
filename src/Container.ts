import { Container } from 'inversify';
import 'reflect-metadata';

import { TYPES } from './ContainerTypes';
import { NewsScraperDaemon } from './Services/NewsScraperDaemon';
import { NewsScraperManager } from './Services/NewsScraperManager';

const container = new Container({
  defaultScope: 'Singleton',
  autoBindInjectable: true,
});

container.bind<NewsScraperManager>(TYPES.NewsScraperManager).to(NewsScraperManager);
container.bind<NewsScraperDaemon>(TYPES.NewsScraperDaemon).to(NewsScraperDaemon);

export { container };
