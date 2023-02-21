import * as express from 'express';
import { Server } from 'http';
import { injectable } from 'inversify';

import { checkIfPortIsInUse } from '../Utils/Helpers';
import { logger } from './Logger';

@injectable()
export class HTTPServerService {
  private _expressApp!: express.Express;
  private _httpServer!: Server;
  private _status: 'NOT_READY' | 'READY' | 'TERMINATING' = 'NOT_READY';

  async start(port: number, listenCallback?: () => void) {
    logger.info(`========== Starting the HTTP server... ==========`);

    const isPortInUse = await checkIfPortIsInUse(port);
    if (isPortInUse) {
      throw new Error(`Port ${port} is already in use`);
    }

    this._expressApp = express();

    this._httpServer = this._expressApp.listen(port, async () => {
      logger.info(`HTTP server started. Listening on port ${port} ...`);

      this._status = 'READY';

      listenCallback?.();
    });
  }

  async terminate() {
    return new Promise((resolve, reject) => {
      this._status = 'TERMINATING';

      this.getHttpServer().close((err) => {
        if (err) {
          reject(err.message);
          return;
        }

        resolve(void 0);
      });
    });
  }

  async registerKubernetesEndpoints() {
    const expressApp = this.getExpressApp();

    expressApp.get('/health', async (_, res) => {
      if (this._status === 'NOT_READY') {
        res.status(500).send('SERVER_NOT_READY');
      } else if (this._status === 'READY') {
        res.status(200).send('SERVER_READY');
      } else if (this._status === 'TERMINATING') {
        res.status(500).send('SERVER_TERMINATING');
      }
    });

    expressApp.get('/live', async (_, res) => {
      if (this._status === 'TERMINATING') {
        res.status(500).send('SERVER_NOT_LIVE');
      } else {
        res.status(200).send('SERVER_LIVE');
      }
    });

    expressApp.get('/ready', async (_, res) => {
      if (this._status === 'READY') {
        res.status(200).send('SERVER_READY');
      } else {
        res.status(500).send('SERVER_NOT_READY');
      }
    });
  }

  getExpressApp() {
    return this._expressApp;
  }

  getHttpServer() {
    return this._httpServer;
  }

  setStatus(status: typeof this._status) {
    this._status = status;

    return this;
  }
}
