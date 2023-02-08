import { createClient } from 'redis';
import superjson from 'superjson';

import { REDIS_URL } from '../Utils/Constants';

export class RedisService {
  private _client?: ReturnType<typeof createClient>;
  private _subClient?: ReturnType<typeof createClient>;
  private _pubClient?: ReturnType<typeof createClient>;

  async getClient() {
    return this.connect();
  }

  async getSubClient() {
    return this.subConnect();
  }

  async getPubClient() {
    return this.pubConnect();
  }

  async connect() {
    if (!this._client) {
      this._client = createClient({ url: REDIS_URL });

      await this._client.connect();
    }

    return this._client;
  }

  async subConnect() {
    if (!this._subClient) {
      const client = await this.getClient();

      this._subClient = client.duplicate();

      await this._subClient.connect();
    }

    return this._subClient;
  }

  async pubConnect() {
    if (!this._pubClient) {
      const client = await this.getClient();

      this._pubClient = client.duplicate();

      await this._pubClient.connect();
    }

    return this._pubClient;
  }

  async quit() {
    const client = await this.getClient();
    await client.quit();

    const subClient = await this.getSubClient();
    await subClient.quit();

    const pubClient = await this.getPubClient();
    await pubClient.quit();
  }

  async disconnect() {
    const client = await this.getClient();
    await client.disconnect();

    const subClient = await this.getSubClient();
    await subClient.disconnect();

    const pubClient = await this.getPubClient();
    await pubClient.disconnect();
  }

  async get(key: string) {
    const client = await this.getClient();

    return client.get(key);
  }

  async set(key: string, value: string, publishChannel: boolean | string = false) {
    const client = await this.getClient();
    const result = await client.set(key, value);

    if (typeof publishChannel === 'string') {
      await this.publish(publishChannel, value);
    }

    return result;
  }

  async subscribe(key: string | string[], callback: (message: string) => void) {
    const subClient = await this.getSubClient();

    return subClient.subscribe(key, callback);
  }

  async unsubscribe(key: string | string[], callback: (message: string) => void) {
    const subClient = await this.getSubClient();

    return subClient.unsubscribe(key, callback);
  }

  async publish(key: string, message: string) {
    const pubClient = await this.getPubClient();

    return pubClient.publish(key, message);
  }

  async getArray(key: string) {
    const value = await this.get(key);

    return (value ? value.split(',') : '') || [];
  }

  async setArray(key: string, value: string[], doPublish: boolean = false) {
    const newValue = Array.from(new Set(value));
    const newValueString = newValue.join(',');

    await this.set(key, newValueString, doPublish);

    return newValue;
  }

  async getJson<T>(key: string, fallbackValue: T): Promise<T> {
    const value = await this.get(key);

    return superjson.parse<T>(value) ?? fallbackValue;
  }

  async setJson<T>(key: string, value: T, doPublish: boolean = false): Promise<T> {
    await this.set(key, superjson.stringify(value), doPublish);

    return value;
  }

  async addToArray(key: string, value: string | string[], doPublish: boolean = false) {
    const currentArray = await this.getArray(key);
    if (Array.isArray(value)) {
      for (const single of value) {
        currentArray.push(single);
      }
    } else {
      currentArray.push(value);
    }

    const newValue = await this.setArray(key, currentArray, doPublish);

    return newValue;
  }

  async removeFromArray(key: string, value: string | string[], doPublish: boolean = false) {
    const currentArray = await this.getArray(key);
    const newArray = currentArray.filter((item) => {
      return Array.isArray(value) ? !value.includes(item) : value !== item;
    });

    const newValue = await this.setArray(key, newArray, doPublish);

    return newValue;
  }
}
