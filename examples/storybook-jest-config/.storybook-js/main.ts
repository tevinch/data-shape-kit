import type { StorybookConfig } from '@storybook/react-webpack5';
const config: StorybookConfig = {
  stories: ['../src/*.stories.js'],
  framework: { name: '@storybook/react-webpack5', options: {} },
  core: { disableTelemetry: true },
};
export default config;
