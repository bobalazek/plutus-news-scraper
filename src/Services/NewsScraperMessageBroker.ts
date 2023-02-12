import * as amqplib from 'amqplib';
import { inject, injectable } from 'inversify';
import superjson from 'superjson';

import { TYPES } from '../DI/ContainerTypes';
import { NewsMessageBrokerQueuesDataType, NewsMessageBrokerQueuesEnum } from '../Types/NewsMessageBrokerQueues';
import { RabbitMQService } from './RabbitMQService';

@injectable()
export class NewsScraperMessageBroker {
  private _channelName: string = 'news_scraper';

  constructor(@inject(TYPES.RabbitMQService) private _rabbitMQService: RabbitMQService) {}

  async sendToQueue<T extends NewsMessageBrokerQueuesEnum>(
    queueName: T,
    data: NewsMessageBrokerQueuesDataType[T],
    publishOptions?: amqplib.Options.Publish,
    assertOptions?: amqplib.Options.AssertQueue
  ) {
    return this._rabbitMQService.sendToQueue(queueName, data, publishOptions, assertOptions, this._channelName);
  }

  async consume<T extends NewsMessageBrokerQueuesEnum>(
    queueName: T,
    callback: (data: NewsMessageBrokerQueuesDataType[T], acknowledgeMessageCallback: () => void) => void,
    consumeOptions?: amqplib.Options.Consume
  ) {
    return this._rabbitMQService.consume(
      queueName,
      (data: NewsMessageBrokerQueuesDataType[T], message, channel) => {
        callback(data, () => {
          channel.ack(message);
        });
      },
      consumeOptions,
      undefined,
      this._channelName
    );
  }

  async consumeOneAtTime<T extends NewsMessageBrokerQueuesEnum>(
    queueName: T,
    callback: (data: NewsMessageBrokerQueuesDataType[T], acknowledgeMessageCallback: () => void) => void
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

        callback(superjson.parse(message.content.toString()), () => {
          channel.ack(message);
        });
      },
      { noAck: false }
    );
  }

  /**
   * ========== Specific queues ==========
   */
  async sendToRecentArticlesScrapeQueue(
    data: NewsMessageBrokerQueuesDataType[NewsMessageBrokerQueuesEnum.NEWS_RECENT_ARTICLES_SCRAPE],
    expiration?: number
  ) {
    return this.sendToQueue(
      NewsMessageBrokerQueuesEnum.NEWS_RECENT_ARTICLES_SCRAPE,
      data,
      { expiration, persistent: true },
      { durable: true }
    );
  }

  async consumeRecentArticlesScrapeQueue(
    callback: (
      data: NewsMessageBrokerQueuesDataType[NewsMessageBrokerQueuesEnum.NEWS_RECENT_ARTICLES_SCRAPE],
      acknowledgeMessageCallback: () => void
    ) => void
  ) {
    return this.consumeOneAtTime(NewsMessageBrokerQueuesEnum.NEWS_RECENT_ARTICLES_SCRAPE, callback);
  }

  async sendToArticleScrapeQueue(
    data: NewsMessageBrokerQueuesDataType[NewsMessageBrokerQueuesEnum.NEWS_ARTICLE_SCRAPE],
    expiration?: number
  ) {
    return this.sendToQueue(
      NewsMessageBrokerQueuesEnum.NEWS_ARTICLE_SCRAPE,
      data,
      { expiration, persistent: true },
      { durable: true }
    );
  }

  async consumeArticleScrapeQueue(
    callback: (
      data: NewsMessageBrokerQueuesDataType[NewsMessageBrokerQueuesEnum.NEWS_ARTICLE_SCRAPE],
      acknowledgeMessageCallback: () => void
    ) => void
  ) {
    return this.consumeOneAtTime(NewsMessageBrokerQueuesEnum.NEWS_ARTICLE_SCRAPE, callback);
  }
}
