import { Command } from 'commander';

import { container } from '../DI/Container';
import { CONTAINER_TYPES } from '../DI/ContainerTypes';
import { Logger } from '../Services/Logger';
import { NewsScraperManager } from '../Services/NewsScraperManager';

export const addNewsScraperRecentArticlesScrapeCommand = (program: Command) => {
  const command = program
    .command('news-scraper:recent-articles:scrape')
    .requiredOption('-n, --news-site <newsSite>', 'Which platform do we want to scrape?')
    .option('-u, --url <url>', 'Is there a specific URL we want to scrape?')
    .option('-h, --headful', 'If this option is passed, then it will open an actual browser window')
    .option('-p, --prevent-close', 'Should we prevent closing the scraper at the end?')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .action(async (options: any) => {
      const newsSite = options.newsSite;
      const url = options.url;
      const headful = options.headful;
      const preventClose = options.preventClose;

      const logger = container.get<Logger>(CONTAINER_TYPES.Logger);
      const newsScraperManager = container.get<NewsScraperManager>(CONTAINER_TYPES.NewsScraperManager);

      try {
        await newsScraperManager.scrapeRecentArticles(newsSite, url ? [url] : undefined, headful, preventClose);
      } catch (err) {
        logger.error(err.message);
      } finally {
        await newsScraperManager.terminate();
      }
    });
  program.addCommand(command);
};
