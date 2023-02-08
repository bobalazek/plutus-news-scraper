import { Command } from 'commander';

import { addNewsArchivedArticlesScrapeCommand } from './Commands/NewsArchivedArticlesScrapeCommand';
import { addNewsArticleScrapeCommand } from './Commands/NewsArticleScrapeCommand';
import { addNewsRecentArticlesScrapeCommand } from './Commands/NewsRecentArticlesScrapeCommand';
import { addNewsSchedulerStartCommand } from './Commands/NewsSchedulerStartCommand';

const program = new Command();

addNewsArticleScrapeCommand(program);
addNewsRecentArticlesScrapeCommand(program);
addNewsArchivedArticlesScrapeCommand(program);
addNewsSchedulerStartCommand(program);

program.parse(process.argv);
