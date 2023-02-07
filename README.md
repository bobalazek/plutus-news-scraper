# Plutus News Scraper

This is the news component of the Plutus platform.

## Getting started

- Install dependencies with `npm install`

## Commands

- To scrape an article, run: `yarn cli news:article:scrape --url <url> [-h,--headful][-p,--prevent-close]`
- To scrape the recent articles, run: `yarn cli news:recent-articles:scrape --news-site <news-site> [-h,--headful][-p,--prevent-close]`
- To scrape the archived articles, run: `yarn cli news:archived-articles:scrape --news-site <news-site> [-h,--headful][-p,--prevent-close]`
- To start the daemon, run: `yarn cli news:daemon:start`

## Docker

- To build the container, run: `docker build --tag plutus-news-scraper .`
- To run any command, use `docker run -it plutus-news-scraper` instead of `yarn cli`, for example: `docker run -it plutus-news-scraper news:recent-articles:scrape --news-site bbc`
