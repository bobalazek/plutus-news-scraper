import * as amqplib from 'amqplib';
import { inject, injectable } from 'inversify';
import superjson from 'superjson';

import { CONTAINER_TYPES } from '../DI/ContainerTypes';
import { NewsMessageBrokerQueuesDataType, NewsScraperMessageBrokerQueuesEnum } from '../Types/NewsMessageBrokerQueues';
import { RabbitMQService } from './RabbitMQService';

@injectable()
export class NewsScraperMessageBroker {
  private _channelName: string = 'news_scraper';

  constructor(@inject(CONTAINER_TYPES.RabbitMQService) private _rabbitMQService: RabbitMQService) {}

  async sendToQueue<T extends NewsScraperMessageBrokerQueuesEnum>(
    queueName: T,
    data: NewsMessageBrokerQueuesDataType[T],
    publishOptions?: amqplib.Options.Publish,
    assertOptions?: amqplib.Options.AssertQueue
  ) {
    return this._rabbitMQService.sendToQueue(queueName, data, publishOptions, assertOptions, this._channelName);
  }

  async purgeQueue(queueName: NewsScraperMessageBrokerQueuesEnum) {
    return this._rabbitMQService.purgeQueue(queueName);
  }

  async deleteQueue(queueName: NewsScraperMessageBrokerQueuesEnum, deleteQueueOptions?: amqplib.Options.DeleteQueue) {
    return this._rabbitMQService.deleteQueue(queueName, deleteQueueOptions);
  }

  async consumeFromQueue<T extends NewsScraperMessageBrokerQueuesEnum>(
    queueName: T,
    callback: (
      data: NewsMessageBrokerQueuesDataType[T],
      acknowledgeMessageCallback: () => void,
      negativeAcknowledgeMessageCallback: () => void
    ) => void,
    consumeOptions?: amqplib.Options.Consume
  ) {
    return this._rabbitMQService.consumeFromQueue(
      queueName,
      (data: NewsMessageBrokerQueuesDataType[T], message, channel) => {
        callback(
          data,
          () => {
            channel.ack(message);
          },
          () => {
            channel.nack(message);
          }
        );
      },
      consumeOptions,
      undefined,
      this._channelName
    );
  }

  async consumeFromQueueOneAtTime<T extends NewsScraperMessageBrokerQueuesEnum>(
    queueName: T,
    callback: (
      data: NewsMessageBrokerQueuesDataType[T],
      acknowledgeMessageCallback: () => void,
      negativeAcknowledgeMessageCallback: () => void
    ) => void
  ) {
    const channel = await this._rabbitMQService.getChannel();
    await this._rabbitMQService.addQueueToChannel(queueName, { durable: true }, this._channelName);
    await channel.prefetch(1);

    return channel.consume(
      queueName,
      (message) => {
        if (message === null) {
          return;
        }

        callback(
          superjson.parse(message.content.toString()),
          () => {
            channel.ack(message);
          },
          () => {
            channel.nack(message);
          }
        );
      },
      { noAck: false }
    );
  }

  async getMessageCountInQueue(queueName: NewsScraperMessageBrokerQueuesEnum) {
    return this._rabbitMQService.getMessageCountInQueue(queueName);
  }

  async cancelChannel() {
    return this._rabbitMQService.cancelChannel('cancel', this._channelName);
  }

  async getMessageCountInAllQueues(
    queues: NewsScraperMessageBrokerQueuesEnum[] = [
      NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_QUEUE,
      NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_ARTICLE_SCRAPE_QUEUE,
    ]
  ) {
    const data = {} as Record<NewsScraperMessageBrokerQueuesEnum, number>;

    for (const queue of queues) {
      const count = await this.getMessageCountInQueue(queue);

      data[queue] = count;
    }

    return data;
  }

  async terminate() {
    return this._rabbitMQService.terminate();
  }
}
