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
- `yarn cli news-scraper:database:migrations:run` - to execute database migrations

## Docker

- To build the container, run: `docker build --tag plutus-news-scraper .`
- To run any command, use `docker run -it plutus-news-scraper` instead of `yarn cli`, for example: `docker run -it plutus-news-scraper news-scraper:recent-articles:scrape --news-site bbc`
