import { createHash } from 'crypto';
import express from 'express';
import { NewsArticle, Person, WithContext } from 'schema-dts';

import { NewsArticleType } from '../Schemas/NewsArticleSchema';

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

export const generateHash = (obj: Record<string, string>): string => {
  return createHash('sha256').update(JSON.stringify(obj), 'utf8').digest('hex');
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

type NewsArticleLinkedDataReturnType = Pick<
  Omit<NewsArticleType, 'newsSiteArticleId'>,
  'title' | 'publishedAt' | 'modifiedAt' | 'imageUrl' | 'authors' | 'languageCode'
> & {
  newsSiteArticleId: string | undefined;
};
export const getNewsArticleLinkedData = (
  linkedData: WithContext<NewsArticle>,
  baseUrl?: string
): NewsArticleLinkedDataReturnType => {
  const authors: { name: string; url?: string }[] = [];
  let imageUrl: string | undefined = undefined;

  if (Array.isArray(linkedData.author)) {
    linkedData.author.forEach((author: unknown) => {
      const typedAuthor = author as Person;
      if (typeof typedAuthor === 'string') {
        authors.push({
          name: typedAuthor,
        });
        return;
      }

      authors.push({
        name: typedAuthor.name as string,
        url:
          (baseUrl && typeof typedAuthor.url === 'string' && typedAuthor.url.startsWith('/')
            ? `${baseUrl}${typedAuthor.url}`
            : (typedAuthor.url as string)) ?? undefined,
      });
    });
  }

  if (linkedData.image) {
    imageUrl = (linkedData.image as string) ?? undefined;
  }

  return {
    title: linkedData.headline as string,
    publishedAt: new Date(linkedData.datePublished as string),
    modifiedAt: new Date(linkedData.dateModified as string),
    imageUrl,
    authors,
    newsSiteArticleId:
      typeof linkedData.identifier === 'string' || typeof linkedData.identifier === 'number'
        ? linkedData.identifier.toString()
        : Array.isArray(linkedData.identifier)
        ? typeof linkedData.identifier[0] === 'string' || typeof linkedData.identifier[0] === 'number'
          ? linkedData.identifier[0].toString()
          : (linkedData.identifier[0] as { value: string }).value
        : undefined,
    languageCode: (linkedData.inLanguage as string) ?? undefined,
  };
};
