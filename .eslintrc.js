/* eslint-disable */
module.exports = {
  root: true,
  env: {
    browser: false,
    es2021: true,
  },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  plugins: ['@typescript-eslint'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'comma-dangle': 'off',
    '@typescript-eslint/no-inferrable-types': 'off',
  },
  ignorePatterns: ['!**/*'],
};
