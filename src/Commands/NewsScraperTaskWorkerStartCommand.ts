import { Command } from 'commander';

import { container } from '../DI/Container';
import { TYPES } from '../DI/ContainerTypes';
import { logger } from '../Services/Logger';
import { NewsScraperTaskWorker } from '../Services/NewsScraperTaskWorker';
import { randomString } from '../Utils/Helpers';

export const addNewsScraperTaskWorkerStartCommand = (program: Command) => {
  const command = program
    .command('news-scraper:task-worker:start')
    .option('-i, --id <id>', 'What is the ID for the worker? If left empty it will be assigned automatically')
    .option('-p, --prometheus-metrics-server-port <port>', 'What is the port for the prometheus server?')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .action(async (options: any) => {
      const prometheusMetricsServerPort = options.prometheusMetricsServerPort;
      const newsScraperTaskWorker = container.get<NewsScraperTaskWorker>(TYPES.NewsScraperTaskWorker);

      try {
        await newsScraperTaskWorker.start(options.id ?? randomString(6), prometheusMetricsServerPort ?? undefined);
      } catch (err) {
        await newsScraperTaskWorker.terminate(err.message);

        logger.error(err.message);
      }
    });
  program.addCommand(command);
};
