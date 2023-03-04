import { createHash } from 'crypto';
import express from 'express';

import { NewsScraperMessageBrokerQueuesEnum } from '../Types/NewsMessageBrokerQueues';

export const randomString = (length: number): string => {
  return [...Array(length)].map(() => (~~(Math.random() * 36)).toString(36)).join('');
};

export const checkIfPortIsInUse = async (port: number): Promise<boolean> => {
  const app = express();
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      server.close();
      resolve(false);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      }
    });
  });
};

export const sleep = (milliseconds: number): Promise<unknown> => {
  return new Promise((resolve) => {
    return setTimeout(resolve, milliseconds);
  });
};

export const getHashForNewsSiteAndQueue = (newsSite: string, queue: NewsScraperMessageBrokerQueuesEnum): string => {
  return createHash('sha256')
    .update(
      JSON.stringify({
        queue,
        newsSite,
      }),
      'utf8'
    )
    .digest('hex');
};

export const getUniqueArray = <T>(array: T[]) => {
  return [
    ...new Set<T>(
      array.filter((val) => {
        return !!val;
      })
    ),
  ];
};
