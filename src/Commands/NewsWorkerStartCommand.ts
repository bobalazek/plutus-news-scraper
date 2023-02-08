import { Command } from 'commander';

import { container } from '../DI/Container';
import { TYPES } from '../DI/ContainerTypes';
import { logger } from '../Services/Logger';
import { NewsScraperWorker } from '../Services/NewsScraperWorker';
import { randomString } from '../Utils/Helpers';

export const addNewsWorkerStartCommand = (program: Command) => {
  const command = program
    .command('news:worker:start')
    .option('-i, --id', 'What is the ID for the worker? If left empty it will be assigned automatically')
    .action(async (option) => {
      const NewsScraperWorker = container.get<NewsScraperWorker>(TYPES.NewsScraperWorker);

      try {
        await NewsScraperWorker.start(option.id ?? randomString(6));
      } catch (err) {
        logger.error(err.message);
      }
    });
  program.addCommand(command);
};
