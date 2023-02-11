import { injectable } from 'inversify';
import { DbOptions, MongoClient } from 'mongodb';

import { MONGODB_URL } from '../Utils/Environment';

@injectable()
export class MongoDBService {
  private _client?: MongoClient;

  async getDatabase(name: string, options?: DbOptions) {
    const client = await this.getClient();

    return client.db(name, options);
  }

  async connect() {
    if (!this._client) {
      this._client = new MongoClient(MONGODB_URL);

      await this._client.connect();
    }

    return this._client;
  }

  async getClient() {
    return this.connect();
  }

  async close() {
    await this._client?.close();
  }
}
