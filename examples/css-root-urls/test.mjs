import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import * as esbuild from 'esbuild';

const here = fileURLToPath(new URL('.', import.meta.url));
const fixtures = path.join(here, 'fixtures');
const baseline = process.env.CSS_BUNDLE_BASELINE === '1';
const plugin = baseline ? null : (await import('./css-root-urls.mjs')).cssRootUrls;
const options = baseline ? { external: ['/*'] } : { plugins: [plugin] };

function checkBundle(result) {
  const css = result.outputFiles.find(file => file.path.endsWith('.css')).text;
  assert.match(css, /\.message\s*\{/, 'b.css must be bundled');
  assert.match(css, /\.nested\s*\{/, 'nested/c.css must be bundled');
  assert.match(css, /@media screen/, 'import conditions must survive');
  assert.doesNotMatch(css, /@import/, 'no relative CSS imports should remain');
  assert.ok(css.includes('/images/epic.png?v=1#preview'));
  assert.ok(css.includes('/fonts/example.woff2?v=2'));
  assert.equal(Object.keys(result.metafile.inputs).length, 3);
  const output = Object.values(result.metafile.outputs).find(file => file.entryPoint);
  assert.deepEqual(output.imports.map(value => [value.path, value.external]).sort(), [
    ['/fonts/example.woff2?v=2', true],
    ['/images/epic.png?v=1#preview', true],
  ]);
  assert.equal(result.outputFiles.length, 1, 'root assets must not be emitted');
}

test('complete CSS bundle preserves root images, fonts and import conditions', async () => {
  const result = await esbuild.build({
    absWorkingDir: fixtures, entryPoints: ['a.css'], bundle: true,
    outfile: 'out.css', write: false, metafile: true, ...options,
  });
  checkBundle(result);
});

test('known resource directories also work with ordinary CLI flags', () => {
  const cli = path.join(here, 'node_modules/esbuild/bin/esbuild');
  for (const cwd of [fixtures, path.join(fixtures, 'nested')]) {
    const css = execFileSync(process.execPath, [cli, path.join(fixtures, 'a.css'),
      '--bundle', '--external:/images/*', '--external:/fonts/*'], { cwd, encoding: 'utf8' });
    assert.match(css, /\.message\s*\{/);
    assert.match(css, /\.nested\s*\{/);
    assert.doesNotMatch(css, /@import/);
    assert.ok(css.includes('/images/epic.png?v=1#preview'));
    assert.ok(css.includes('/fonts/example.woff2?v=2'));
  }
});

test('CSS resolver runs while JS absolute imports and entry points still bundle', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'css-root-urls-'));
  try {
    const js = path.join(root, 'value.js');
    await writeFile(js, 'export const value = 42;');
    await writeFile(path.join(root, 'a.css'), '@import "/theme.css"; .asset { background:url("/asset?id=2#x") }');
    await writeFile(path.join(root, 'main.js'), `import {value} from ${JSON.stringify(js)}; import './a.css'; console.log(value);`);
    const calls = [];
    const observer = { name: 'observe-css-resolution', setup(build) {
      build.onResolve({ filter: /^\// }, args => {
        calls.push({ path: args.path, kind: args.kind });
      });
    } };
    const result = await esbuild.build({
      absWorkingDir: root, entryPoints: [path.join(root, 'main.js')], bundle: true,
      outdir: 'out', write: false, metafile: true,
      ...(baseline ? options : { plugins: [observer, plugin] }),
    });
    const cssFile = result.outputFiles.find(file => file.path.endsWith('.css'));
    assert.ok(cssFile, 'the imported stylesheet must produce a CSS bundle');
    const css = cssFile.text;
    const outputJs = result.outputFiles.find(file => file.path.endsWith('.js')).text;
    assert.match(outputJs, /42/);
    assert.doesNotMatch(outputJs, /require\(|from /, 'absolute JS import must not be external');
    assert.ok(css.includes('/theme.css'));
    assert.ok(css.includes('/asset?id=2#x'));
    const cssOutput = Object.entries(result.metafile.outputs).find(([name]) => name.endsWith('.css'))[1];
    assert.deepEqual(cssOutput.imports.map(i => [i.path, i.kind, i.external]).sort(), [
      ['/asset?id=2#x', 'url-token', true], ['/theme.css', 'import-rule', true],
    ]);
    assert.ok(calls.some(c => c.path === '/theme.css' && c.kind === 'import-rule'));
    assert.ok(calls.some(c => c.path === '/asset?id=2#x' && c.kind === 'url-token'));
    assert.ok(calls.some(c => c.path === path.join(root, 'main.js') && c.kind === 'entry-point'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('relative assets use their loader and explicit external imports stay external', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'css-root-urls-'));
  try {
    await mkdir(path.join(root, 'nested'));
    await writeFile(path.join(root, 'a.css'), '@import "kept.css"; @import "nested/b.css";');
    await writeFile(path.join(root, 'nested/b.css'), '.icon { background: url("./icon.svg?x#y") }');
    await writeFile(path.join(root, 'nested/icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    const result = await esbuild.build({
      absWorkingDir: root, entryPoints: ['a.css'], bundle: true,
      outdir: 'out', write: false, metafile: true, loader: { '.svg': 'file' },
      ...options, external: baseline ? ['/*', 'kept.css'] : ['kept.css'],
    });
    const css = result.outputFiles.find(file => file.path.endsWith('.css')).text;
    assert.match(css, /@import "kept.css"/);
    assert.match(css, /\.icon\s*\{/);
    assert.match(css, /icon-[\w]+\.svg\?x#y/);
    assert.equal(result.outputFiles.filter(file => file.path.endsWith('.svg')).length, 1);
    await assert.rejects(esbuild.build({
      absWorkingDir: root, stdin: { contents: '@import "missing.css";', loader: 'css', resolveDir: root },
      bundle: true, write: false, logLevel: 'silent', ...options,
    }), /Could not resolve "missing.css"/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
