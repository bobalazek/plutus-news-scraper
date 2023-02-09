import * as amqplib from 'amqplib';
import { injectable } from 'inversify';
import superjson from 'superjson';

import { RABBITMQ_URL } from '../Utils/Constants';

@injectable()
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
    callback: (data: T[keyof T], message: amqplib.ConsumeMessage, channel: amqplib.Channel) => void,
    autoAcknowledge: boolean = true
  ) {
    const channel = await this.getChannel(channelName as string);

    return channel.consume(channelName as string, (message) => {
      if (message === null) {
        return;
      }

      callback(superjson.parse<T[keyof T]>(message.content.toString()), message, channel);

      if (autoAcknowledge) {
        channel.ack(message);
      }
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
