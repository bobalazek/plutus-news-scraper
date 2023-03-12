import { Command } from 'commander';

import { container } from '../DI/Container';
import { CONTAINER_TYPES } from '../DI/ContainerTypes';
import { Logger } from '../Services/Logger';
import { NewsScraperManager } from '../Services/NewsScraperManager';

export const addNewsScraperArchivedArticlesScrapeCommand = (program: Command) => {
  const command = program
    .command('news-scraper:archived-articles:scrape')
    .requiredOption('-n, --news-site <newsSite>', 'Which platform do we want to scrape?')
    .option('-o, --options <options>', 'Which options you want to provide? Needs to be a valid JSON string.')
    .option('-h, --headful', 'If this option is passed, then it will open an actual browser window')
    .option('-p, --prevent-close', 'Should we prevent closing the scraper at the end?')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .action(async (options: any) => {
      const newsSite = options.newsSite;
      const optionsString = options.options;
      const headful = options.headful;
      const preventClose = options.preventClose;

      const parsedOptions = optionsString ? JSON.parse(optionsString) : undefined;

      const logger = container.get<Logger>(CONTAINER_TYPES.Logger);
      const newsScraperManager = container.get<NewsScraperManager>(CONTAINER_TYPES.NewsScraperManager);

      try {
        await newsScraperManager.scrapeArchivedArticles(newsSite, parsedOptions, headful, preventClose);
      } catch (err) {
        logger.error(err.message);
      } finally {
        await newsScraperManager.terminate();
      }
    });
  program.addCommand(command);
};
