import { Command } from 'commander';

import { container } from '../Container';
import { TYPES } from '../ContainerTypes';
import { logger } from '../Services/Logger';
import { NewsScraperDaemon } from '../Services/NewsScraperDaemon';

export const addNewsDaemonStartCommand = (program: Command) => {
  const command = program.command('news:daemon:start').action(async () => {
    const newsScraperDaemon = container.get<NewsScraperDaemon>(TYPES.NewsScraperDaemon);

    try {
      await newsScraperDaemon.start();
    } catch (err) {
      logger.error(err.message);
    }
  });
  program.addCommand(command);
};
