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

  async consume<T>(
    channelName: string,
    callback: (data: T, fields: amqplib.ConsumeMessageFields, properties: amqplib.MessageProperties) => void
  ) {
    const channel = await this.getChannel(channelName);

    return channel.consume(channelName, (msg) => {
      if (msg === null) {
        return;
      }

      callback(superjson.parse<T>(msg.content.toString()), msg.fields, msg.properties);

      channel.ack(msg);
    });
  }

  async send<T>(channelName: string, value: T) {
    const channel = await this.getChannel(channelName);

    return channel.sendToQueue(channelName, Buffer.from(superjson.stringify(value)));
  }

  async close() {
    for (const channel of this._channelsMap.values()) {
      await channel.close();
    }

    await this._connection?.close();
  }
}
