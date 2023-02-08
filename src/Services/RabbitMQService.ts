import * as amqplib from 'amqplib';
import superjson from 'superjson';

import { RABBITMQ_URL } from '../Utils/Constants';

export class RabbitMQService {
  private _connection?: amqplib.Connection;
  private _channelsMap: Map<string, amqplib.Channel> = new Map();

  async connect() {
    if (!this._connection) {
      this._connection = await amqplib.connect(RABBITMQ_URL);
    }

    return this._connection;
  }

  async getConnection() {
    return this.connect();
  }

  async getChannel(channelName: string) {
    const connection = await this.getConnection();

    let channel = this._channelsMap.get(channelName);
    if (!channel) {
      channel = await connection.createChannel();
      await channel.assertQueue(channelName);

      this._channelsMap.set(channelName, channel);
    }

    return channel;
  }

  // TODO: typescript is not yet fully inferring it correcly when we are calling that
  async consume<T extends Record<string, Record<string, string>>>(
    channelName: keyof T,
    callback: (data: T[keyof T], fields: amqplib.ConsumeMessageFields, properties: amqplib.MessageProperties) => void
  ) {
    const channel = await this.getChannel(channelName as string);

    return channel.consume(channelName as string, (msg) => {
      if (msg === null) {
        return;
      }

      callback(superjson.parse<T[keyof T]>(msg.content.toString()), msg.fields, msg.properties);

      channel.ack(msg);
    });
  }

  // TODO: typescript is not yet fully inferring it correcly when we are calling that
  async send<T extends Record<string, Record<string, string>>>(channelName: keyof T, value: T[keyof T]) {
    const channel = await this.getChannel(channelName as string);

    return channel.sendToQueue(channelName as string, Buffer.from(superjson.stringify(value)));
  }

  async close() {
    for (const channel of this._channelsMap.values()) {
      await channel.close();
    }

    await this._connection?.close();
  }
}
