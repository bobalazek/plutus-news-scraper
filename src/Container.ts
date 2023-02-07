import { Container } from 'inversify';
import 'reflect-metadata';

import { TYPES } from './ContainerTypes';
import { NewsScraperManager } from './Services/NewsScraperManager';

const container = new Container({
  defaultScope: 'Singleton',
  autoBindInjectable: true,
});

container.bind<NewsScraperManager>(TYPES.NewsScraperManager).to(NewsScraperManager);

export { container };
