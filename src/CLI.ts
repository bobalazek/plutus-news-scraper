import { Command } from 'commander';

import { addNewsArchivedArticlesScrapeCommand } from './Commands/NewsArchivedArticlesScrapeCommand';
import { addNewsArticleScrapeCommand } from './Commands/NewsArticleScrapeCommand';
import { addNewsDaemonStartCommand } from './Commands/NewsDaemonStartCommand';
import { addNewsRecentArticlesScrapeCommand } from './Commands/NewsRecentArticlesScrapeCommand';

const program = new Command();

addNewsArticleScrapeCommand(program);
addNewsRecentArticlesScrapeCommand(program);
addNewsArchivedArticlesScrapeCommand(program);
addNewsDaemonStartCommand(program);

program.parse(process.argv);
