import { Command } from 'commander';

import { addScrapeArticleCommand } from './Commands/ScrapeArticleCommand';
import { addScrapeRecentArticlesCommand } from './Commands/ScrapeRecentArticlesCommand';

const program = new Command();

addScrapeRecentArticlesCommand(program);
addScrapeArticleCommand(program);

program.parse(process.argv);
