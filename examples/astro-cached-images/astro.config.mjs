import { defineConfig } from 'astro/config';

export default defineConfig({
  build: { inlineStylesheets: 'never', concurrency: 4 },
  experimental: { incrementalBuild: true },
});
