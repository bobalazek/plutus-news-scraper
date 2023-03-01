import { Command } from 'commander';

import { container } from '../DI/Container';
import { CONTAINER_TYPES } from '../DI/ContainerTypes';
import { Logger } from '../Services/Logger';
import { NewsScraperDatabase } from '../Services/NewsScraperDatabase';

export const addNewsScraperDatabaseMigrationsRunCommand = (program: Command) => {
  const command = program.command('news-scraper:database:migrations:run').action(async () => {
    const logger = container.get<Logger>(CONTAINER_TYPES.Logger);
    const newsScraperDatabase = container.get<NewsScraperDatabase>(CONTAINER_TYPES.NewsScraperDatabase);

    try {
      await newsScraperDatabase.runMigrations();
    } catch (err) {
      logger.error(err.message);
    }
  });
  program.addCommand(command);
};
