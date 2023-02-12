import * as amqplib from 'amqplib';
import { injectable } from 'inversify';
import superjson from 'superjson';

import { RABBITMQ_URL } from '../Utils/Environment';

@injectable()
export class RabbitMQService {
  private _connection?: amqplib.Connection;
  private _channelsMap: Map<string, amqplib.Channel> = new Map();

  async getChannel(channelName: string, options?: amqplib.Options.AssertQueue) {
    const connection = await this.getConnection();

    let channel = this._channelsMap.get(channelName);
    if (!channel) {
      channel = await connection.createChannel();
      await channel.assertQueue(channelName, options);

      this._channelsMap.set(channelName, channel);
    }

    return channel;
  }

  // TODO: not really infered yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async consume<T extends Record<keyof T, any>>(
    channelName: keyof T,
    callback: (data: T[keyof T], message: amqplib.ConsumeMessage, channel: amqplib.Channel) => void,
    autoAcknowledge: boolean = true,
    options?: amqplib.Options.Consume
  ) {
    const channel = await this.getChannel(channelName as string);

    return channel.consume(
      channelName as string,
      (message) => {
        if (message === null) {
          return;
        }

        callback(superjson.parse<T[keyof T]>(message.content.toString()), message, channel);

        if (autoAcknowledge) {
          channel.ack(message);
        }
      },
      options
    );
  }

  // TODO: not really infered yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async get<T extends Record<keyof T, any>>(channelName: keyof T, options?: amqplib.Options.Consume) {
    const channel = await this.getChannel(channelName as string);

    const message = await channel.get(channelName as string, options);
    if (message === false) {
      return null;
    }

    return {
      data: superjson.parse<T[keyof T]>(message.content.toString()),
      message,
      channel,
    };
  }

  // TODO: same here
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async send<T extends Record<keyof T, any>>(
    channelName: keyof T,
    value: T[keyof T],
    options?: amqplib.Options.Publish
  ) {
    const channel = await this.getChannel(channelName as string);

    return channel.sendToQueue(channelName as string, Buffer.from(superjson.stringify(value)), options);
  }

  async connect() {
    if (!this._connection) {
      this._connection = await amqplib.connect(RABBITMQ_URL);
    }

    return this._connection;
  }

  async getConnection() {
    return this.connect();
  }

  async close() {
    for (const channel of this._channelsMap.values()) {
      await channel.close();
    }

    await this._connection?.close();
  }
}
