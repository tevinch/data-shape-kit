import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    minify: 'terser',
    license: { fileName: 'THIRD_PARTY_NOTICES.md' },
  },
});
