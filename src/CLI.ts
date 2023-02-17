import { Command } from 'commander';

import { addNewsScraperArchivedArticlesScrapeCommand } from './Commands/NewsScraperArchivedArticlesScrapeCommand';
import { addNewsScraperArticleScrapeCommand } from './Commands/NewsScraperArticleScrapeCommand';
import { addNewsScraperDatabaseMigrationsRunCommand } from './Commands/NewsScraperDatabaseMigrationsRunCommand';
import { addNewsScraperRecentArticlesScrapeCommand } from './Commands/NewsScraperRecentArticlesScrapeCommand';
import { addNewsScraperTaskDispatcherStartCommand } from './Commands/NewsScraperTaskDispatcherStartCommand';
import { addNewsScraperTaskWorkerStartCommand } from './Commands/NewsScraperTaskWorkerStartCommand';

const program = new Command();

addNewsScraperArticleScrapeCommand(program);
addNewsScraperRecentArticlesScrapeCommand(program);
addNewsScraperArchivedArticlesScrapeCommand(program);
addNewsScraperTaskDispatcherStartCommand(program);
addNewsScraperTaskWorkerStartCommand(program);
addNewsScraperDatabaseMigrationsRunCommand(program);

program.parse(process.argv);
