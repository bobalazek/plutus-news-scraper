import { Command } from 'commander';

import { container } from '../Container';
import { TYPES } from '../ContainerTypes';
import { logger } from '../Services/Logger';
import { NewsScraperScheduler } from '../Services/NewsScraperScheduler';

export const addNewsSchedulerStartCommand = (program: Command) => {
  const command = program.command('news:scheduler:start').action(async () => {
    const newsScraperScheduler = container.get<NewsScraperScheduler>(TYPES.NewsScraperScheduler);

    try {
      await newsScraperScheduler.start();
    } catch (err) {
      logger.error(err.message);
    }
  });
  program.addCommand(command);
};
