import { fileURLToPath } from 'node:url';
import { getJestConfig } from '@storybook/test-runner';
const config = getJestConfig();
export default {
  ...config,
  rootDir: fileURLToPath(new URL('.', import.meta.url)),
  testEnvironmentOptions: {
    'jest-playwright': {
      ...config.testEnvironmentOptions['jest-playwright'],
      launchOptions: process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {},
    },
  },
};
