import { join } from 'path';

// Environment variables
export const IS_DEVELOPMENT = process.env.NODE_ENV !== 'prod';
export const PUPPETEER_EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH ?? undefined;
export const RABBITMQ_URL = process.env.RABBITMQ_URL;
export const REDIS_URL = process.env.REDIS_URL;

// RabbitMQ channels
export const NEWS_RECENT_ARTICLES_SCRAPE_CHANNEL = 'news.recent_articles.scrape';
export const NEWS_ARTICLE_SCRAPE_CHANNEL = 'news.article.scrape';

// Paths
export const ROOT_DIRECTORY = join(__dirname, '..');
