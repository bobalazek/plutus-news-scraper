import { Command } from 'commander';

import { logger } from '../Logger';
import { NewsScrapingManager } from '../NewsScrapingManager';

export const addScrapeRecentArticlesCommand = (program: Command) => {
  const command = program
    .command('recent-articles:scrape')
    .requiredOption('-n, --news-site <newsSite>', 'Which platform do we want to scrape?')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .action(async (options: any) => {
      const newsSite = options.newsSite;

      const newsScrapingManager = new NewsScrapingManager();

      try {
        await newsScrapingManager.scrapeRecentArticles(newsSite);
      } catch (err) {
        logger.error(err.message);
      }
    });
  program.addCommand(command);
};
