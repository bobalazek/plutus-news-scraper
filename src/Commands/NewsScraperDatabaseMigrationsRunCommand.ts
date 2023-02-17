import { Command } from 'commander';

import { container } from '../DI/Container';
import { TYPES } from '../DI/ContainerTypes';
import { logger } from '../Services/Logger';
import { NewsScraperDatabase } from '../Services/NewsScraperDatabase';

export const addNewsScraperDatabaseMigrationsRunCommand = (program: Command) => {
  const command = program.command('news-scraper:database:migrations:run').action(async () => {
    const newsScraperDatabase = container.get<NewsScraperDatabase>(TYPES.NewsScraperDatabase);

    try {
      await newsScraperDatabase.runMigrations();
    } catch (err) {
      logger.error(err.message);
    }
  });
  program.addCommand(command);
};
