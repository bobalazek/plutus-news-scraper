import * as express from 'express';

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
