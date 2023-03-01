import { Command } from 'commander';

import { container } from '../DI/Container';
import { CONTAINER_TYPES } from '../DI/ContainerTypes';
import { Logger } from '../Services/Logger';
import { NewsScraperTaskDispatcher } from '../Services/NewsScraperTaskDispatcher';

export const addNewsScraperTaskDispatcherStartCommand = (program: Command) => {
  const command = program
    .command('news-scraper:task-dispatcher:start')
    .option('-p, --http-server-port <port>', 'What is the port for the HTTP server?')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .action(async (options: any) => {
      const httpServerPort = options.httpServerPort;

      const logger = container.get<Logger>(CONTAINER_TYPES.Logger);
      const newsScraperTaskDispatcher = container.get<NewsScraperTaskDispatcher>(
        CONTAINER_TYPES.NewsScraperTaskDispatcher
      );

      try {
        await newsScraperTaskDispatcher.start(httpServerPort ?? undefined);
        await newsScraperTaskDispatcher.terminate();
      } catch (err) {
        await newsScraperTaskDispatcher.terminate(err.message);

        logger.error(err.message);
      }
    });
  program.addCommand(command);
};
