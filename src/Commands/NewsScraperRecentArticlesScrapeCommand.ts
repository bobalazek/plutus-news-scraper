import { Command } from 'commander';

import { container } from '../DI/Container';
import { TYPES } from '../DI/ContainerTypes';
import { logger } from '../Services/Logger';
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

      const newsScraperManager = container.get<NewsScraperManager>(TYPES.NewsScraperManager);
      newsScraperManager.setHeadful(headful);
      newsScraperManager.setPreventClose(preventClose);

      try {
        await newsScraperManager.scrapeRecentArticles(newsSite, url ? [url] : undefined);
      } catch (err) {
        await newsScraperManager.terminateScraper();

        logger.error(err.message);
      }
    });
  program.addCommand(command);
};
