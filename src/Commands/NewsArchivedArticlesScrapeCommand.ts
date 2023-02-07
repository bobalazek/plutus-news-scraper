import { Command } from 'commander';

import { container } from '../Container';
import { TYPES } from '../ContainerTypes';
import { logger } from '../Services/Logger';
import { NewsScraperManager } from '../Services/NewsScraperManager';

export const addNewsArchivedArticlesScrapeCommand = (program: Command) => {
  const command = program
    .command('news:archived-articles:scrape')
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

      const newsScraperManager = container.get<NewsScraperManager>(TYPES.NewsScraperManager);
      newsScraperManager.setHeadful(headful);
      newsScraperManager.setPreventClose(preventClose);

      try {
        const parsedOptions = JSON.parse(optionsString);

        await newsScraperManager.scrapeArchivedArticles(newsSite, parsedOptions);
      } catch (err) {
        await newsScraperManager.terminateScraper();

        logger.error(err.message);
      }
    });
  program.addCommand(command);
};
