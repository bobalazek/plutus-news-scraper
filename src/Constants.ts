import { join } from 'path';

export const IS_DEVELOPMENT = process.env.NODE_ENV !== 'prod';

export const ROOT_DIRECTORY = join(__dirname, '..');
