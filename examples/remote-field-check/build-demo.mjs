import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const notices = [];
for (const name of ['react', 'react-dom', 'scheduler', 'react-hook-form']) {
  const directory = dirname(require.resolve(`${name}/package.json`));
  const pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
  const license = await readFile(join(directory, 'LICENSE'), 'utf8');
  notices.push(`${name} ${pkg.version}\n${license.trim()}\n`);
}
await build({
  entryPoints: ['demo.tsx'], outfile: 'demo.js', bundle: true,
  format: 'iife', platform: 'browser', target: ['es2022'], jsx: 'automatic',
  minify: true, legalComments: 'inline',
  define: { 'process.env.NODE_ENV': '"production"' },
});
await writeFile('THIRD_PARTY_NOTICES.txt', notices.join('\n---\n\n'));
