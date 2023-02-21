import * as express from 'express';
import { injectable } from 'inversify';
import * as promClient from 'prom-client';

import { PROMETHEUS_PUSHGATEWAY_URL } from '../Utils/Environment';

@injectable()
export class PrometheusService {
  private _pushgateway?: promClient.Pushgateway;

  getClient() {
    return promClient;
  }

  getPushgateway() {
    if (!this._pushgateway) {
      const client = this.getClient();

      if (!PROMETHEUS_PUSHGATEWAY_URL) {
        throw new Error(`Prometheus pushgateway URL not set`);
      }

      this._pushgateway = new client.Pushgateway(PROMETHEUS_PUSHGATEWAY_URL);
    }

    return this._pushgateway;
  }

  addDefaultMetrics(config?: promClient.DefaultMetricsCollectorConfiguration) {
    const client = this.getClient();

    client.collectDefaultMetrics(config);
  }

  addMetricsEndpointToExpressApp(expressApp: express.Express) {
    expressApp.get('/metrics', async (_, res) => {
      const client = this.getClient();

      res.set('Content-type', client.register.contentType);

      const metrics = await client.register.metrics();

      return res.send(metrics);
    });
  }
}
