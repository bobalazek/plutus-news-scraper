import * as express from 'express';
import { injectable } from 'inversify';
import * as promClient from 'prom-client';

import { PROMETHEUS_PUSHGATEWAY_URL } from '../Utils/Environment';

@injectable()
export class PrometheusService {
  private _prometheusPushgateway?: promClient.Pushgateway;

  getPrometheusClient() {
    return promClient;
  }

  getPrometheusPushgateway() {
    if (!PROMETHEUS_PUSHGATEWAY_URL) {
      throw new Error(`Prometheus pushgateway URL not set`);
    }

    if (!this._prometheusPushgateway) {
      const prometheusClient = this.getPrometheusClient();

      this._prometheusPushgateway = new prometheusClient.Pushgateway(PROMETHEUS_PUSHGATEWAY_URL);
    }

    return this._prometheusPushgateway;
  }

  addDefaultMetrics(config?: promClient.DefaultMetricsCollectorConfiguration) {
    const prometheusClient = this.getPrometheusClient();
    prometheusClient.collectDefaultMetrics(config);
  }

  addMetricsEndpointToHttpServer(httpServer: express.Express) {
    httpServer.get('/metrics', async (_, res) => {
      const prometheusClient = this.getPrometheusClient();
      const metrics = await prometheusClient.register.metrics();

      res.set('Content-type', prometheusClient.register.contentType);
      return res.send(metrics);
    });
  }
}
