import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const cjs = process.env.GRID_FORMAT === 'cjs';
export default defineConfig({
  // Keep React's wrapper and the fixture on the same Community module registry.
  resolve: cjs ? { alias: [
    { find: /^ag-grid-react$/, replacement: fileURLToPath(new URL('./node_modules/ag-grid-react/dist/package/index.cjs.js', import.meta.url)) },
    { find: /^ag-grid-community$/, replacement: fileURLToPath(new URL('./node_modules/ag-grid-community/dist/package/main.cjs.js', import.meta.url)) },
  ] } : {},
  build: { outDir: cjs ? 'dist-cjs' : 'dist-esm', sourcemap: false },
});
