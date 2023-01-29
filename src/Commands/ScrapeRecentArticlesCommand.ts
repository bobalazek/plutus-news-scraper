import { Command } from 'commander';

import { logger } from '../Logger';
import { NewsScrapingManager } from '../NewsScrapingManager';

export const addScrapeRecentArticlesCommand = (program: Command) => {
  const command = program
    .command('recent-articles:scrape')
    .requiredOption('-n, --news-site <newsSite>', 'Which platform do we want to scrape?')
    .option('-h, --headful', 'If this option is passed, then it will open an actual browser window')
    .option('-p, --prevent-close', 'Should we prevent closing the scraper at the end?')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .action(async (options: any) => {
      const newsSite = options.newsSite;
      const headful = options.headful;
      const preventClose = options.preventClose;

      const newsScrapingManager = new NewsScrapingManager();
      newsScrapingManager.setHeadful(headful);
      newsScrapingManager.setPreventClose(preventClose);

      try {
        await newsScrapingManager.scrapeRecentArticles(newsSite);
      } catch (err) {
        await newsScrapingManager.terminateScraper();

        logger.error(err.message);
      }
    });
  program.addCommand(command);
};
