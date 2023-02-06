import { Command } from 'commander';

import { addArchivedArticlesScrapeCommand } from './Commands/ArchivedArticlesScrapeCommand';
import { addNewsArticleScrapeCommand } from './Commands/NewsArticleScrapeCommand';
import { addNewsRecentArticlesScrapeCommand } from './Commands/NewsRecentArticlesScrapeCommand';

const program = new Command();

addNewsArticleScrapeCommand(program);
addNewsRecentArticlesScrapeCommand(program);
addArchivedArticlesScrapeCommand(program);

program.parse(process.argv);
