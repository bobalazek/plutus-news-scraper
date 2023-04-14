import 'dotenv/config';

// TODO
// dotenv needs to be included because of TypeormDataSource.ts is included as a standalone file.
// Any better way to do this?

export const APP_PREFIX = 'news_scraper_';
export const NODE_ENV = process.env.NODE_ENV;
export const IS_TEST = NODE_ENV === 'test';
export const IS_DEVELOPMENT = NODE_ENV !== 'prod';
export const PUPPETEER_EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH as string;
export const RABBITMQ_URL = process.env.RABBITMQ_URL as string;
export const REDIS_URL = process.env.REDIS_URL as string;
export const LOKI_URL = process.env.LOKI_URL as string;
export const LOKI_PINO_BATCH_INTERVAL_SECONDS = 2;
export const POSTGRESQL_URL = process.env.POSTGRESQL_URL as string;
export const PROMETHEUS_PUSHGATEWAY_URL = process.env.PROMETHEUS_PUSHGATEWAY_URL as string;
