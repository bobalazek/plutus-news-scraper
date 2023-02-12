import { inject, injectable } from 'inversify';

import { TYPES } from '../DI/ContainerTypes';
import { NewsMessageBrokerChannelsDataType, NewsMessageBrokerChannelsEnum } from '../Types/NewsMessageBrokerChannels';
import { RabbitMQService } from './RabbitMQService';

@injectable()
export class NewsScraperMessageBroker {
  constructor(@inject(TYPES.RabbitMQService) private _rabbitMQService: RabbitMQService) {}

  async sendToQueue<T extends NewsMessageBrokerChannelsEnum>(
    channelName: T,
    value: NewsMessageBrokerChannelsDataType[T],
    expiration?: number
  ) {
    return this._rabbitMQService.sendToQueue(channelName, value, { expiration });
  }

  async consume<T extends NewsMessageBrokerChannelsEnum>(
    channelName: T,
    callback: (data: NewsMessageBrokerChannelsDataType[T], acknowledgeMessageCallback: () => void) => void
  ) {
    return this._rabbitMQService.consume(
      channelName,
      (data: NewsMessageBrokerChannelsDataType[T], message, channel) => {
        callback(data, () => {
          channel.ack(message);
        });
      },
      false
    );
  }
}
