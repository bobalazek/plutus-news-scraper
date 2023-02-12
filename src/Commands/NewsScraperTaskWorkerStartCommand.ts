import { Command } from 'commander';

import { container } from '../DI/Container';
import { TYPES } from '../DI/ContainerTypes';
import { logger } from '../Services/Logger';
import { NewsScraperTaskWorker } from '../Services/NewsScraperTaskWorker';
import { randomString } from '../Utils/Helpers';

export const addNewsScraperTaskWorkerStartCommand = (program: Command) => {
  const command = program
    .command('news-scraper:task-worker:start')
    .option('-i, --id', 'What is the ID for the worker? If left empty it will be assigned automatically')
    .action(async (option) => {
      const newsScraperTaskWorker = container.get<NewsScraperTaskWorker>(TYPES.NewsScraperTaskWorker);

      try {
        await newsScraperTaskWorker.start(option.id ?? randomString(6));
      } catch (err) {
        logger.error(err.message);
      }
    });
  program.addCommand(command);
};
