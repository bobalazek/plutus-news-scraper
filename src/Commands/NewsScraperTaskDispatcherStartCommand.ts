import { Command } from 'commander';

import { container } from '../DI/Container';
import { TYPES } from '../DI/ContainerTypes';
import { logger } from '../Services/Logger';
import { NewsScraperTaskDispatcher } from '../Services/NewsScraperTaskDispatcher';

export const addNewsScraperTaskDispatcherStartCommand = (program: Command) => {
  const command = program.command('news-scraper:task-dispatcher:start').action(async () => {
    const newsScraperTaskDispatcher = container.get<NewsScraperTaskDispatcher>(TYPES.NewsScraperTaskDispatcher);

    try {
      await newsScraperTaskDispatcher.start();
    } catch (err) {
      logger.error(err.message);
    }
  });
  program.addCommand(command);
};
