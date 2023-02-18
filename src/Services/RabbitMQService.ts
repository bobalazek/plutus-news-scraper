import * as amqplib from 'amqplib';
import { injectable } from 'inversify';
import superjson from 'superjson';

import { RABBITMQ_URL } from '../Utils/Environment';

@injectable()
export class RabbitMQService {
  DEFAULT_CHANNEL_NAME: string = '__DEFAULT';

  private _connection?: amqplib.Connection;
  private _channelsMap: Map<string, amqplib.Channel> = new Map();
  private _channelQueuesMap: Map<string, Set<string>> = new Map();

  async getChannel(channelName?: string) {
    if (!channelName) {
      channelName = this.DEFAULT_CHANNEL_NAME;
    }

    const connection = await this.getConnection();

    let channel = this._channelsMap.get(channelName);
    if (!channel) {
      channel = await connection.createChannel();

      this._channelsMap.set(channelName, channel);
      this._channelQueuesMap.set(channelName, new Set());
    }

    return channel;
  }

  async addQueueToChannel(queueName: string, assertQueueOptions?: amqplib.Options.AssertQueue, channelName?: string) {
    const channel = await this.getChannel(channelName);

    if (!channelName) {
      channelName = this.DEFAULT_CHANNEL_NAME;
    }

    let channelQueues = this._channelQueuesMap.get(channelName);
    if (!channelQueues) {
      channelQueues = new Set();

      this._channelQueuesMap.set(channelName, channelQueues);
    }

    if (!channelQueues.has(queueName)) {
      await channel.assertQueue(queueName, assertQueueOptions);

      channelQueues.add(queueName);
    }

    return channel;
  }

  async consumeFromQueue(
    queueName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callback: (data: any, message: amqplib.ConsumeMessage, channel: amqplib.Channel) => void,
    consumeOptions?: amqplib.Options.Consume,
    assertQueueOptions?: amqplib.Options.AssertQueue,
    channelName?: string
  ) {
    const channel = await this.getChannel(queueName);
    await this.addQueueToChannel(queueName, assertQueueOptions, channelName);

    return channel.consume(
      queueName,
      (message) => {
        if (message === null) {
          return;
        }

        callback(superjson.parse(message.content.toString()), message, channel);
      },
      consumeOptions
    );
  }

  async sendToQueue(
    queueName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    publishOptions?: amqplib.Options.Publish,
    assertQueueOptions?: amqplib.Options.AssertQueue,
    channelName?: string
  ) {
    const channel = await this.getChannel(channelName);
    await this.addQueueToChannel(queueName, assertQueueOptions, channelName);

    return channel.sendToQueue(queueName, Buffer.from(superjson.stringify(data)), publishOptions);
  }

  async purgeQueue(queueName: string) {
    try {
      const connection = await this.getConnection();
      const tmpChannel = await connection.createChannel();
      const result = await tmpChannel.purgeQueue(queueName);
      await tmpChannel.close();

      return result.messageCount;
    } catch (err) {
      return 0;
    }
  }

  async deleteQueue(queueName: string, deleteQueueOptions?: amqplib.Options.DeleteQueue) {
    try {
      const connection = await this.getConnection();
      const tmpChannel = await connection.createChannel();
      const result = await tmpChannel.deleteQueue(queueName, deleteQueueOptions);
      await tmpChannel.close();

      return result.messageCount;
    } catch (err) {
      return 0;
    }
  }

  async getMessageCountInQueue(queueName: string) {
    try {
      const connection = await this.getConnection();
      const tmpChannel = await connection.createChannel();
      const result = await tmpChannel.checkQueue(queueName);
      await tmpChannel.close();

      return result.messageCount;
    } catch (err) {
      return 0;
    }
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
