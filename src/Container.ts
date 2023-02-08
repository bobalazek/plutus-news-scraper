import { Container } from 'inversify';
import 'reflect-metadata';

import { TYPES } from './ContainerTypes';
import { NewsScraperManager } from './Services/NewsScraperManager';
import { NewsScraperScheduler } from './Services/NewsScraperScheduler';

const container = new Container({
  defaultScope: 'Singleton',
  autoBindInjectable: true,
});

container.bind<NewsScraperManager>(TYPES.NewsScraperManager).to(NewsScraperManager);
container.bind<NewsScraperScheduler>(TYPES.NewsScraperScheduler).to(NewsScraperScheduler);

export { container };
