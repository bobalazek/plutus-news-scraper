import { Command } from 'commander';

import { addNewsArchivedArticlesScrapeCommand } from './Commands/NewsArchivedArticlesScrapeCommand';
import { addNewsArticleScrapeCommand } from './Commands/NewsArticleScrapeCommand';
import { addNewsRecentArticlesScrapeCommand } from './Commands/NewsRecentArticlesScrapeCommand';
import { addNewsSchedulerStartCommand } from './Commands/NewsSchedulerStartCommand';
import { addNewsWorkerStartCommand } from './Commands/NewsWorkerStartCommand';

const program = new Command();

addNewsArticleScrapeCommand(program);
addNewsRecentArticlesScrapeCommand(program);
addNewsArchivedArticlesScrapeCommand(program);
addNewsSchedulerStartCommand(program);
addNewsWorkerStartCommand(program);

program.parse(process.argv);
