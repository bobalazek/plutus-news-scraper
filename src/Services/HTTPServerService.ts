import * as express from 'express';
import { Server } from 'http';
import { injectable } from 'inversify';

import { checkIfPortIsInUse } from '../Utils/Helpers';
import { logger } from './Logger';

@injectable()
export class HTTPServerService {
  private _expressApp!: express.Express;
  private _httpServer!: Server;

  async start(port: number, listenCallback?: () => void) {
    logger.info(`========== Starting the HTTP server... ==========`);

    const isPortInUse = await checkIfPortIsInUse(port);
    if (isPortInUse) {
      throw new Error(`Port ${port} is already in use`);
    }

    this._expressApp = express();

    this._httpServer = this._expressApp.listen(port, async () => {
      logger.info(`HTTP server started. Listening on port ${port} ...`);

      listenCallback?.();
    });
  }

  async terminate() {
    return new Promise((resolve, reject) => {
      this._httpServer.close((err) => {
        if (err) {
          reject(err.message);
          return;
        }

        resolve(void 0);
      });
    });
  }

  getExpressApp() {
    return this._expressApp;
  }

  getHttpServer() {
    return this._httpServer;
  }
}
