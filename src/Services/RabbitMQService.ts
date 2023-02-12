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

  async consume(
    channelName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callback: (data: any, message: amqplib.ConsumeMessage, channel: amqplib.Channel) => void,
    autoAcknowledge: boolean = true,
    options?: amqplib.Options.Consume
  ) {
    const channel = await this.getChannel(channelName);

    return channel.consume(
      channelName,
      (message) => {
        if (message === null) {
          return;
        }

        callback(superjson.parse(message.content.toString()), message, channel);

        if (autoAcknowledge) {
          channel.ack(message);
        }
      },
      options
    );
  }

  async get(
    channelName: string,
    channelOptions?: amqplib.Options.AssertQueue,
    messageOptions?: amqplib.Options.Consume
  ) {
    const channel = await this.getChannel(channelName, channelOptions);

    const message = await channel.get(channelName, messageOptions);
    if (message === false) {
      return null;
    }

    return {
      data: superjson.parse(message.content.toString()),
      message,
      channel,
    };
  }

  async sendToQueue(
    channelName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any,
    options?: amqplib.Options.Publish
  ) {
    const channel = await this.getChannel(channelName);

    return channel.sendToQueue(channelName, Buffer.from(superjson.stringify(value)), options);
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
