# Plutus News Scraper

This is the news component of the Plutus platform.

## Getting started

- Install dependencies with `npm install`

## Commands

- To scrape an article, run: `yarn cli news-scraper:article:scrape --url <url> [-h,--headful][-p,--prevent-close]`
- To scrape the recent articles, run: `yarn cli news-scraper:recent-articles:scrape --news-site <news-site> [-u,--url <url>][-h,--headful][-p,--prevent-close]`
- To scrape the archived articles, run: `yarn cli news-scraper:archived-articles:scrape --news-site <news-site> [-h,--headful][-p,--prevent-close]`
- To start the scheduler, run: `yarn cli news-scraper:scheduler:start`
- To start a worker, run: `yarn cli news-scraper:worker:start [-i,--id <id>]`

## Docker

- To build the container, run: `docker build --tag plutus-news-scraper .`
- To run any command, use `docker run -it plutus-news-scraper` instead of `yarn cli`, for example: `docker run -it plutus-news-scraper news-scraper:recent-articles:scrape --news-site bbc`
