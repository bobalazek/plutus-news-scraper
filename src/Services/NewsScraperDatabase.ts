import { injectable } from 'inversify';
import { DataSource } from 'typeorm';

import { NewsArticle } from '../Entitites/NewsArticle';
import { IS_DEVELOPMENT, POSTGRESQL_URL } from '../Utils/Environment';

@injectable()
export class NewsScraperDatabase {
  protected _dataSource!: DataSource;

  async getDataSource() {
    if (!this._dataSource) {
      this._dataSource = new DataSource({
        type: 'postgres',
        url: POSTGRESQL_URL,
        entities: [NewsArticle],
        synchronize: IS_DEVELOPMENT,
        // TODO: add migrations files? or classes? How does it work in typescript
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
