import { injectable } from 'inversify';
import pino from 'pino';

import { IS_DEVELOPMENT, LOKI_PINO_BATCH_INTERVAL_SECONDS, LOKI_URL } from '../Utils/Environment';

@injectable()
export class Logger implements pino.BaseLogger {
  private _logger: ReturnType<typeof pino>;

  level: string = 'trace';

  constructor() {
    const transport = pino.transport({
      targets: [
        ...(IS_DEVELOPMENT
          ? [
              {
                target: 'pino-pretty',
                level: this.level,
                options: {
                  minimumLevel: this.level,
                  colorize: true,
                },
              },
            ]
          : []),
        ...(LOKI_URL
          ? [
              {
                target: 'pino-loki',
                level: this.level,
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
    this._logger = pino({ level: this.level }, transport);
  }

  fatal(...args: unknown[]) {
    if (args.length === 1) {
      return this._logger.fatal(args[0]);
    }

    return this._logger.fatal(args);
  }

  error(...args: unknown[]) {
    if (args.length === 1) {
      return this._logger.error(args[0]);
    }

    return this._logger.error(args);
  }

  warn(...args: unknown[]) {
    if (args.length === 1) {
      return this._logger.warn(args[0]);
    }

    return this._logger.warn(args);
  }

  info(...args: unknown[]) {
    if (args.length === 1) {
      return this._logger.info(args[0]);
    }

    return this._logger.info(args);
  }

  debug(...args: unknown[]) {
    if (args.length === 1) {
      return this._logger.debug(args[0]);
    }

    return this._logger.debug(args);
  }

  trace(...args: unknown[]) {
    if (args.length === 1) {
      return this._logger.trace(args[0]);
    }

    return this._logger.trace(args);
  }

  silent(...args: unknown[]) {
    if (args.length === 1) {
      return this._logger.silent(args[0]);
    }

    return this._logger.silent(args);
  }
}
