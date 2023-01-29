import { Command } from 'commander';

import { logger } from '../Logger';
import { NewsScrapingManager } from '../NewsScrapingManager';

export const addScrapeArticleCommand = (program: Command) => {
  const command = program
    .command('article:scrape')
    .requiredOption('-u, --url <url>', 'Which URL do we want to scrape?')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .action(async (options: any) => {
      const url = options.url;

      const newsScrapingManager = new NewsScrapingManager();

      try {
        await newsScrapingManager.scrapeArticle(url);
      } catch (err) {
        logger.error(err.message);
      }
    });
  program.addCommand(command);
};
