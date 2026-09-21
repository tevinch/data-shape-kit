import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = process.cwd();
const packageRoot = path.resolve(process.argv[2] || 'node_modules/svelte');
const label = process.argv[3] || 'original';
const metadata = JSON.parse(await fs.readFile(path.join(packageRoot, 'package.json'), 'utf8'));
const aliases = Object.fromEntries(Object.entries(metadata.exports).flatMap(([key, value]) => {
  const target = typeof value === 'string' ? value : value.browser || value.default;
  return target ? [[key === '.' ? 'svelte' : `svelte/${key.slice(2)}`, path.resolve(packageRoot, target)]] : [];
}));
const { compile } = await import(pathToFileURL(path.join(packageRoot, 'src/compiler/index.js')));
for (const async of [false, true]) {
  for (const dev of [true, false]) {
    const name = `${label}-${async ? 'async' : 'sync'}-${dev ? 'dev' : 'prod'}`;
    const output = path.join(root, '.verification', 'dist', name);
    await fs.mkdir(output, { recursive: true });
    await build({
      stdin: { contents: `import {mount} from 'svelte'; import App from './App.svelte'; import {async_mode_flag} from ${JSON.stringify(path.join(packageRoot,'src/internal/flags/index.js'))}; window.checks.asyncMode=async_mode_flag; mount(App,{target:document.getElementById('app')});`, resolveDir: root },
      bundle: true,
      format: 'esm',
      platform: 'browser',
      conditions: ['browser', dev ? 'development' : 'production'],
      alias: aliases,
      outfile: path.join(output, 'app.js'),
      plugins: [{ name: 'svelte', setup(builder) {
        builder.onLoad({ filter: /\.svelte$/ }, async ({path: file}) => {
          const source = await fs.readFile(file, 'utf8');
          return {contents: compile(source,{ filename:file, generate:'client',dev,experimental:{async} }).js.code,loader:'js',resolveDir:path.dirname(file)};
        });
      }}]
    });
    await fs.writeFile(path.join(output, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><title>Scheduling check</title></head><body><div id="app"></div><script>window.checks={effects:0,flushes:0,observed:[]};</script><script type="module" src="app.js"></script></body></html>');
    console.log(name);
  }
}
