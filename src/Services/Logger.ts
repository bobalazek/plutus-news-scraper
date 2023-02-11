import pino from 'pino';

import { IS_DEVELOPMENT, LOKI_URL } from '../Utils/Environment';

const targets: pino.TransportTargetOptions<pino.TransportBaseOptions>[] = [];
if (IS_DEVELOPMENT) {
  targets.push();
}

const transport = pino.transport({
  targets: [
    ...(IS_DEVELOPMENT
      ? [
          {
            target: 'pino-pretty',
            level: 'debug',
            options: {
              colorize: true,
            },
          },
        ]
      : []),
    ...(LOKI_URL
      ? [
          {
            target: 'pino-loki',
            level: 'debug',
            options: {
              batching: true,
              interval: 2,
              host: LOKI_URL,
            },
          },
        ]
      : []),
  ],
});

// There are some issues with multiple transports and log level,
// so need to specify the lowest level at the first argument:
// https://github.com/pinojs/pino/issues/1413
// https://github.com/pinojs/pino/issues/1639
const logger = pino({ level: 'trace' }, transport);

export { logger };
