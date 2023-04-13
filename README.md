# Plutus News Scraper

This is the news component of the Plutus platform.

## Getting started

- Install dependencies with `npm install`

## Commands

- `yarn cli news-scraper:article:scrape --url <url> [-h,--headful][-p,--prevent-close]` - to scrape an article
- `yarn cli news-scraper:recent-articles:scrape --news-site <news-site> [-u,--url <url>][-h,--headful][-p,--prevent-close]` - to scrape the recent articles
- `yarn cli news-scraper:archived-articles:scrape --news-site <news-site> [-h,--headful][-p,--prevent-close]` - to scrape the archived articles
- `yarn cli news-scraper:task-dispatcher:start` - to start the task dispatcher
- `yarn cli news-scraper:task-worker:start [-i,--id <id>]` - to start the task worker

### Database

- `yarn typeorm:run-migrations` - to run database migrations
- `yarn typeorm:generate-migration src/Migrations/{MigrationName}` - to generate a new migration

### Docker

- `docker build --tag plutus-news-scraper .` - to build the container
- To run any common command, use `docker run -it plutus-news-scraper` instead of `yarn cli`, for example: `docker run -it plutus-news-scraper news-scraper:recent-articles:scrape --news-site bbc`. Please note, that this will not work for commands that are not in the `cli` script. For those, you'll need to do `docker run -it plutus-news-scraper bash` and then run the command inside the container.
