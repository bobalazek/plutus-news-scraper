import pino from 'pino';

import { IS_DEVELOPMENT } from '../Constants';

const logger = pino({
  level: 'debug',
  transport: IS_DEVELOPMENT
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
        },
      }
    : undefined,
});

export { logger };
