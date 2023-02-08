export const randomString = (length: number): string => {
  return [...Array(length)].map(() => (~~(Math.random() * 36)).toString(36)).join('');
};
