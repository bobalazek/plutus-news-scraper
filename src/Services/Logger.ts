import { injectable } from 'inversify';
import pino from 'pino';

import { IS_DEVELOPMENT, LOKI_PINO_BATCH_INTERVAL_SECONDS, LOKI_URL } from '../Utils/Environment';

@injectable()
export class Logger implements pino.BaseLogger {
  private _logger: ReturnType<typeof pino>;

  level: string = 'debug';

  constructor() {
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
                  interval: LOKI_PINO_BATCH_INTERVAL_SECONDS,
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
    this._logger = pino({ level: 'trace' }, transport);

    this._logger.debug;
  }

  fatal(...args: unknown[]) {
    return this._logger.fatal(args);
  }

  error(...args: unknown[]) {
    return this._logger.error(args);
  }

  warn(...args: unknown[]) {
    return this._logger.warn(args);
  }

  info(...args: unknown[]) {
    return this._logger.info(args);
  }

  debug(...args: unknown[]) {
    return this._logger.debug(args);
  }

  trace(...args: unknown[]) {
    return this._logger.trace(args);
  }

  silent(...args: unknown[]) {
    return this._logger.silent(args);
  }
}
