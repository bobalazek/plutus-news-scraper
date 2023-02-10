import { Command } from 'commander';

import { addNewsScraperArchivedArticlesScrapeCommand } from './Commands/NewsScraperArchivedArticlesScrapeCommand';
import { addNewsScraperArticleScrapeCommand } from './Commands/NewsScraperArticleScrapeCommand';
import { addNewsScraperDatabaseInitCommand } from './Commands/NewsScraperDatabaseInitCommand';
import { addNewsScraperDatabaseResetCommand } from './Commands/NewsScraperDatabaseResetCommand';
import { addNewsScraperRecentArticlesScrapeCommand } from './Commands/NewsScraperRecentArticlesScrapeCommand';
import { addNewsScraperSchedulerStartCommand } from './Commands/NewsScraperSchedulerStartCommand';
import { addNewsScraperWorkerStartCommand } from './Commands/NewsScraperWorkerStartCommand';

const program = new Command();

addNewsScraperArticleScrapeCommand(program);
addNewsScraperRecentArticlesScrapeCommand(program);
addNewsScraperArchivedArticlesScrapeCommand(program);
addNewsScraperSchedulerStartCommand(program);
addNewsScraperWorkerStartCommand(program);
addNewsScraperDatabaseInitCommand(program);
addNewsScraperDatabaseResetCommand(program);

program.parse(process.argv);
