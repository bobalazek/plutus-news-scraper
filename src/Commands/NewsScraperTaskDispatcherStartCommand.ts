import { Command } from 'commander';

import { container } from '../DI/Container';
import { TYPES } from '../DI/ContainerTypes';
import { logger } from '../Services/Logger';
import { NewsScraperTaskDispatcher } from '../Services/NewsScraperTaskDispatcher';

export const addNewsScraperTaskDispatcherStartCommand = (program: Command) => {
  const command = program
    .command('news-scraper:task-dispatcher:start')
    .option('-p, --prometheus-metrics-server-port <port>', 'What is the port for the prometheus server?')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .action(async (options: any) => {
      const prometheusMetricsServerPort = options.prometheusMetricsServerPort;

      const newsScraperTaskDispatcher = container.get<NewsScraperTaskDispatcher>(TYPES.NewsScraperTaskDispatcher);

      try {
        await newsScraperTaskDispatcher.start(prometheusMetricsServerPort ?? undefined);
      } catch (err) {
        await newsScraperTaskDispatcher.terminate(err.message);

        logger.error(err.message);
      }
    });
  program.addCommand(command);
};
