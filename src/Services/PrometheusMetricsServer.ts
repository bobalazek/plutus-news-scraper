import * as express from 'express';
import { injectable } from 'inversify';
import * as promClient from 'prom-client';

import { PROMETHEUS_PUSHGATEWAY_URL } from '../Utils/Environment';
import { checkIfPortIsInUse } from '../Utils/Helpers';
import { logger } from './Logger';

@injectable()
export class PrometheusMetricsServer {
  private _httpServer!: express.Express;
  private _prometheusPushgateway?: promClient.Pushgateway;

  async start(
    httpServerPort: number,
    prometheusClientPrefix: string,
    prometheusClientLabels?: Record<string, string>,
    httpServerCallback?: (app: express.Express) => void
  ) {
    logger.info(`========== Starting the HTTP server and prometheus client ... ==========`);

    const isPortInUse = await checkIfPortIsInUse(httpServerPort);
    if (isPortInUse) {
      throw new Error(`Port ${httpServerPort} is already in use`);
    }

    const prometheusClient = this.getPrometheusClient();
    prometheusClient.collectDefaultMetrics({
      prefix: prometheusClientPrefix,
      labels: prometheusClientLabels,
    });

    this._httpServer = express();

    this._httpServer.get('/metrics', async (_, res) => {
      res.set('Content-type', prometheusClient.register.contentType);

      const metrics = await prometheusClient.register.metrics();

      return res.send(metrics);
    });

    this._httpServer.listen(httpServerPort, async () => {
      logger.info(`HTTP server started. Listening on port ${httpServerPort} ...`);

      httpServerCallback?.(this._httpServer);
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
}
