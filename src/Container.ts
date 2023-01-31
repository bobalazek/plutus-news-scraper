import { Container } from 'inversify';
import 'reflect-metadata';

import { TYPES } from './ContainerTypes';
import { NewsScrapingManager } from './Services/NewsScrapingManager';

const container = new Container({
  defaultScope: 'Singleton',
  autoBindInjectable: true,
});

container.bind<NewsScrapingManager>(TYPES.NewsScrapingManager).to(NewsScrapingManager);

export { container };
