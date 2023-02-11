export const APP_PREFIX = 'news_scraper_';
export const IS_DEVELOPMENT = process.env.NODE_ENV !== 'prod';
export const PUPPETEER_EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH ?? undefined;
export const RABBITMQ_URL = process.env.RABBITMQ_URL;
export const REDIS_URL = process.env.REDIS_URL;
export const MONGODB_URL = process.env.MONGODB_URL;
export const LOKI_URL = process.env.LOKI_URL;
