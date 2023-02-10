import { Command } from 'commander';

import { container } from '../DI/Container';
import { TYPES } from '../DI/ContainerTypes';
import { logger } from '../Services/Logger';
import { NewsScraperDatabaseManager } from '../Services/NewsScraperDatabaseManager';

export const addNewsScraperDatabaseResetCommand = (program: Command) => {
  const command = program.command('news-scraper:database:reset').action(async () => {
    const newsScraperDatabaseManager = container.get<NewsScraperDatabaseManager>(TYPES.NewsScraperDatabaseManager);

    try {
      await newsScraperDatabaseManager.reset();
    } catch (err) {
      logger.error(err.message);
    }
  });
  program.addCommand(command);
};
