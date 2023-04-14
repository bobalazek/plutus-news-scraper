import { injectable } from 'inversify';
import { DataSource } from 'typeorm';

import dataSource from '../Utils/TypeormDataSource';

@injectable()
export class NewsScraperDatabase {
  protected _dataSource!: DataSource;

  async getDataSource() {
    if (!this._dataSource) {
      this._dataSource = dataSource;

      await this._dataSource.initialize();
    }

    return this._dataSource;
  }

  async runMigrations() {
    const dataSource = await this.getDataSource();

    return dataSource.runMigrations();
  }

  async terminate() {
    const dataSource = await this.getDataSource();

    await dataSource.destroy();
  }
}
