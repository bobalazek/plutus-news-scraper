import * as express from 'express';
import { injectable } from 'inversify';

import { checkIfPortIsInUse } from '../Utils/Helpers';
import { logger } from './Logger';

@injectable()
export class HTTPServerService {
  private _httpServer!: express.Express;

  async start(port: number, listenCallback?: (httpServer: express.Express) => void) {
    logger.info(`========== Starting the HTTP server... ==========`);

    const isPortInUse = await checkIfPortIsInUse(port);
    if (isPortInUse) {
      throw new Error(`Port ${port} is already in use`);
    }

    this._httpServer = express();

    this._httpServer.listen(port, async () => {
      logger.info(`HTTP server started. Listening on port ${port} ...`);

      listenCallback?.(this._httpServer);
    });
  }

  getHttpServer() {
    return this._httpServer;
  }
}
