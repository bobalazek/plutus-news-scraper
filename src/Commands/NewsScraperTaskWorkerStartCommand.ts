import { Command } from 'commander';

import { container } from '../DI/Container';
import { CONTAINER_TYPES } from '../DI/ContainerTypes';
import { Logger } from '../Services/Logger';
import { NewsScraperTaskWorker } from '../Services/NewsScraperTaskWorker';
import { randomString } from '../Utils/Helpers';

export const addNewsScraperTaskWorkerStartCommand = (program: Command) => {
  const command = program
    .command('news-scraper:task-worker:start')
    .option('-i, --id <id>', 'What is the ID for the worker? If left empty it will be assigned automatically')
    .option('-p, --http-server-port <port>', 'What is the port for the HTTP server?')
    .option('-q, --consumed-queues <queues>', 'Which queues do we want to consume?', '*')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .action(async (options: any) => {
      const httpServerPort = options.httpServerPort;
      const consumedQueues = options.consumedQueues;

      const logger = container.get<Logger>(CONTAINER_TYPES.Logger);
      const newsScraperTaskWorker = container.get<NewsScraperTaskWorker>(CONTAINER_TYPES.NewsScraperTaskWorker);

      try {
        await newsScraperTaskWorker.start(
          options.id ?? randomString(6),
          httpServerPort ?? undefined,
          consumedQueues.split(',')
        );
        await newsScraperTaskWorker.terminate();
      } catch (err) {
        await newsScraperTaskWorker.terminate(err.message);

        logger.error(err.message);
      }
    });
  program.addCommand(command);
};
