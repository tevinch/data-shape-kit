import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { prepare, root, checkOriginal } from './prepare.mjs';

await mkdir(join(root, 'dist'), { recursive: true });
for (const mode of ['original', 'patched']) {
  const { temporary, packageRoot } = await prepare(mode);
  try {
    await build({
      entryPoints: [join(root, 'demo.jsx')], outfile: join(root, `dist/${mode}.js`),
      bundle: true, format: 'esm', platform: 'browser', minify: true,
      define: { 'process.env.NODE_ENV': '"production"', __MODE__: JSON.stringify(mode) },
      alias: { '@tanstack/form-core': join(packageRoot, 'dist/esm/index.js') },
      legalComments: 'eof',
    });
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
await cp(join(root, 'index.html'), join(root, 'dist/index.html'));
await checkOriginal();
console.log('Built original and patched React comparisons in dist/');
