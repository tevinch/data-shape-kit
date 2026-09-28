import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import { cssRootUrls } from './css-root-urls.mjs';

await esbuild.build({
  absWorkingDir: fileURLToPath(new URL('.', import.meta.url)),
  entryPoints: ['fixtures/a.css'],
  outfile: 'dist/bundle.css',
  bundle: true,
  plugins: [cssRootUrls],
});
