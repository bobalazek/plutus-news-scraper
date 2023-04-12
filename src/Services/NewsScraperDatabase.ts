import { injectable } from 'inversify';
import { DataSource } from 'typeorm';

import { NewsArticle } from '../Entitites/NewsArticle';
import { ScrapeRun } from '../Entitites/ScrapeRun';
import { IS_DEVELOPMENT, POSTGRESQL_URL } from '../Utils/Environment';

@injectable()
export class NewsScraperDatabase {
  protected _dataSource!: DataSource;

  async getDataSource() {
    if (!this._dataSource) {
      this._dataSource = new DataSource({
        type: 'postgres',
        url: POSTGRESQL_URL,
        synchronize: IS_DEVELOPMENT,
        entities: [NewsArticle, ScrapeRun],
        //entities: ['Entities/*.ts'], // TODO: not working yet. Why?
        //migrations: ['Migrations/*.ts'], // TODO: not working yet. Why?
      });

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
