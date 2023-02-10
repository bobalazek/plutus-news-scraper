import { Command } from 'commander';

import { addNewsScraperArchivedArticlesScrapeCommand } from './Commands/NewsScraperArchivedArticlesScrapeCommand';
import { addNewsScraperArticleScrapeCommand } from './Commands/NewsScraperArticleScrapeCommand';
import { addNewsScraperRecentArticlesScrapeCommand } from './Commands/NewsScraperRecentArticlesScrapeCommand';
import { addNewsScraperSchedulerStartCommand } from './Commands/NewsScraperSchedulerStartCommand';
import { addNewsScraperWorkerStartCommand } from './Commands/NewsScraperWorkerStartCommand';

const program = new Command();

addNewsScraperArticleScrapeCommand(program);
addNewsScraperRecentArticlesScrapeCommand(program);
addNewsScraperArchivedArticlesScrapeCommand(program);
addNewsScraperSchedulerStartCommand(program);
addNewsScraperWorkerStartCommand(program);

program.parse(process.argv);
