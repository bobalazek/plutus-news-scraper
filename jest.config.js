/* eslint-disable */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': '@swc/jest',
  },
  testMatch: ['**/src/**/*.test.ts'],
};
