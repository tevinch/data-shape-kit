import { build } from 'esbuild';
await build({ entryPoints: ['browser.mjs'], outfile: 'bundle.js', bundle: true, platform: 'browser', format: 'esm' });
