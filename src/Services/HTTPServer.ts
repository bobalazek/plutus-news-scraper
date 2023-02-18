import * as express from 'express';
import { injectable } from 'inversify';
import * as promClient from 'prom-client';

import { PROMETHEUS_PUSHGATEWAY_URL } from '../Utils/Environment';
import { checkIfPortIsInUse } from '../Utils/Helpers';
import { logger } from './Logger';

interface PrometheusClientOptions {
  prefix: string;
  labels?: Record<string, string>;
}

@injectable()
export class HTTPServer {
  private _httpServer!: express.Express;
  private _prometheusPushgateway?: promClient.Pushgateway;

  async start(
    port: number,
    listenCallback?: (app: express.Express) => void,
    prometheusClientOptions?: PrometheusClientOptions
  ) {
    logger.info(`========== Starting the HTTP server and prometheus client ... ==========`);

    const isPortInUse = await checkIfPortIsInUse(port);
    if (isPortInUse) {
      throw new Error(`Port ${port} is already in use`);
    }

    this._httpServer = express();

    if (prometheusClientOptions) {
      this.addPrometheusMetrics(prometheusClientOptions);
    }

    this._httpServer.listen(port, async () => {
      logger.info(`HTTP server started. Listening on port ${port} ...`);

      listenCallback?.(this._httpServer);
    });
  }

  getHttpServer() {
    return this._httpServer;
  }

  getPrometheusClient() {
    return promClient;
  }

  getPrometheusPushgateway() {
    if (!PROMETHEUS_PUSHGATEWAY_URL) {
      throw new Error(`Prometheus pushgateway URL not set`);
    }

    const prometheusClient = this.getPrometheusClient();
    if (!this._prometheusPushgateway) {
      this._prometheusPushgateway = new prometheusClient.Pushgateway(PROMETHEUS_PUSHGATEWAY_URL);
    }

    return this._prometheusPushgateway;
  }

  addPrometheusMetrics(options: PrometheusClientOptions) {
    if (!this._httpServer) {
      throw new Error(`HTTP server not set up yet`);
    }

    const prometheusClient = this.getPrometheusClient();
    prometheusClient.collectDefaultMetrics({
      prefix: options.prefix,
      labels: options.labels,
    });

    this._httpServer.get('/metrics', async (_, res) => {
      res.set('Content-type', prometheusClient.register.contentType);

      const metrics = await prometheusClient.register.metrics();

      return res.send(metrics);
    });
  }
}
