import { inject, injectable } from 'inversify';

import { TYPES } from '../DI/ContainerTypes';
import { MONGODB_DATABASE_NAME } from '../Utils/Environment';
import { logger } from './Logger';
import { MongoDBService } from './MongoDBService';

@injectable()
export class NewsScraperDatabaseManager {
  constructor(@inject(TYPES.MongoDBService) private _mongoDBService: MongoDBService) {}

  async init() {
    logger.info(`========== Initializing the database ... ==========`);

    await this._createDatabaseCollections();
    await this._createDatabaseIndexes();

    await this._mongoDBService.close();
  }

  async reset() {
    logger.info(`========== Resetting the database ... ==========`);

    await this._dropDatabase();
    await this._createDatabaseCollections();
    await this._createDatabaseIndexes();

    await this._mongoDBService.close();
  }

  async _dropDatabase() {
    logger.info(`Droping the database ...`);

    const database = await this._mongoDBService.getDatabase(MONGODB_DATABASE_NAME);

    await database.dropDatabase();

    logger.info(`Database successfully dropped`);
  }

  async _createDatabaseCollections() {
    logger.info(`Creating database collections ...`);

    const database = await this._mongoDBService.getDatabase(MONGODB_DATABASE_NAME);

    await database.createCollection('news_articles');

    logger.info(`Database collections successfully created`);
  }

  async _createDatabaseIndexes() {
    logger.info(`Creating database indexes ...`);

    const database = await this._mongoDBService.getDatabase(MONGODB_DATABASE_NAME);

    const newsArticlesCollection = database.collection('news_article');

    // Add an unique index on the url field
    await newsArticlesCollection.createIndex(
      {
        url: 1,
      },
      {
        name: 'url_index',
        unique: true,
      }
    );

    // Add a compound unique index on the newsSiteKey and newsSiteArticleId fields
    await newsArticlesCollection.createIndex(
      {
        newsSiteKey: 1,
        newsSiteArticleId: 1,
      },
      {
        name: 'news_site_compound_index',
        unique: true,
      }
    );

    logger.info(`Database indexes successfully created`);
  }
}
