import { Command } from 'commander';

import { container } from '../Container';
import { TYPES } from '../ContainerTypes';
import { logger } from '../Services/Logger';
import { NewsScrapingManager } from '../Services/NewsScrapingManager';

export const addNewsRecentArticlesScrapeCommand = (program: Command) => {
  const command = program
    .command('news:recent-articles:scrape')
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

      const newsScrapingManager = container.get<NewsScrapingManager>(TYPES.NewsScrapingManager);
      newsScrapingManager.setHeadful(headful);
      newsScrapingManager.setPreventClose(preventClose);

      try {
        await newsScrapingManager.scrapeRecentArticles(newsSite, [url]);
      } catch (err) {
        await newsScrapingManager.terminateScraper();

        logger.error(err.message);
      }
    });
  program.addCommand(command);
};