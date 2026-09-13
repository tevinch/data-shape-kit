import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const scratch = path.join(here, '.checks');
await fs.mkdir(scratch, { recursive: true });
const root = await fs.mkdtemp(path.join(scratch, 'build-'));
const results = [];
try {
  for (const entry of ['src', 'astro.config.mjs', 'package.json', 'package-lock.json']) {
    await fs.cp(path.join(here, entry), path.join(root, entry), { recursive: true });
  }
  await fs.symlink(path.join(here, 'node_modules'), path.join(root, 'node_modules'), 'dir');
  const configFile = path.join(root, 'astro.config.mjs');
  await fs.writeFile(configFile, (await fs.readFile(configFile, 'utf8')).replace('defineConfig({', "defineConfig({\n  cacheDir: './cache/',"));
  const cachedPage = path.join(root, 'src/pages/cached/[slug].astro');
  const source = await fs.readFile(cachedPage, 'utf8');
  await fs.writeFile(cachedPage, source
    .replace("import shared", "import { readFileSync } from 'node:fs';\nimport shared")
    .replace("[{ params: { slug: 'x' }, cacheKey: 'v1' }]", "JSON.parse(readFileSync('slugs.json', 'utf8')).map(slug => ({ params: { slug }, cacheKey: 'v1' }))"));
  await fs.writeFile(path.join(root, 'slugs.json'), JSON.stringify(['x', 'y', 'z']));

  async function build(name, expectedCached, expectedColor, expectedPages = ['a/index.html', 'b/index.html', 'cached/x/index.html', 'cached/y/index.html', 'cached/z/index.html', 'team/index.html']) {
    const run = spawnSync(process.execPath, [path.join(here, 'node_modules/astro/bin/astro.mjs'), 'build'], {
      cwd: root,
      env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', NO_COLOR: '1' },
      encoding: 'utf8', timeout: 45000,
    });
    const log = run.stdout + run.stderr;
    await fs.writeFile(path.join(root, `${name}.log`), log);
    assert.ifError(run.error);
    assert.equal(run.status, 0, log);
    const cached = [...log.matchAll(/\/([^\s]+\/index\.html) \(restored\)/g)].map(m => m[1]).sort();
    assert.deepEqual(cached, [...expectedCached].sort(), `${name}: cache hits`);
    const dist = path.join(root, 'dist');
    const pages = (await fs.readdir(dist, { recursive: true })).filter(p => p.endsWith('.html')).sort();
    assert.deepEqual(pages, expectedPages);
    const assets = [];
    for (const page of pages) {
      const html = await fs.readFile(path.join(dist, page), 'utf8');
      const refs = [...html.matchAll(/(?:src|href)="(\/_astro\/[^"?#]+)[^"]*"/g)].map(m => m[1]);
      assert.ok(refs.length > 0, `${page}: expected local asset references`);
      for (const ref of refs) {
        const bytes = await fs.readFile(path.join(dist, ref)).catch(error => {
          throw new Error(`${name}: ${page} references missing ${ref}`, { cause: error });
        });
        assets.push({ page, ref });
        if (ref.endsWith('.css')) assert.match(bytes.toString(), expectedColor);
        else {
          const metadata = await sharp(bytes).metadata();
          assert.equal(metadata.width, page === 'team/index.html' ? 32 : 64);
          assert.equal(metadata.format, page === 'team/index.html' ? 'webp' : 'png');
          await sharp(bytes).raw().toBuffer();
        }
      }
    }
    results.push({ name, cached, pages: pages.length, assets });
    console.log(`${name}: ${pages.length} pages, ${cached.length} cache hits, every local asset exists`);
  }
  const rawPages = ['cached/x/index.html', 'cached/y/index.html', 'cached/z/index.html'];
  const allCached = ['a/index.html', 'b/index.html', ...rawPages];
  await build('first', [], /color:red/);
  await build('second', allCached, /color:red/);
  await build('third', allCached, /color:red/);
  const manifestFile = path.join(root, 'cache/incremental-build.json');
  const manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
  for (const route of Object.values(manifest.routes)) {
    for (const entry of Object.values(route.paths)) delete entry.referencedImages;
  }
  await fs.writeFile(manifestFile, JSON.stringify(manifest));
  await build('old-cache-migration', [], /color:red/);
  await build('after-migration', allCached, /color:red/);
  await fs.writeFile(path.join(root, 'src/styles/_partial.scss'), 'body { color: blue; }\n');
  await build('sass-changed', rawPages, /color:(?:#00f|blue)/);
  await build('after-sass-change', allCached, /color:(?:#00f|blue)/);
  await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 80, g: 70, b: 210 } } })
    .png().toFile(path.join(root, 'src/assets/shared.png'));
  await build('image-changed', ['a/index.html', 'b/index.html'], /color:(?:#00f|blue)/);
  await build('after-image-change', allCached, /color:(?:#00f|blue)/);
  await fs.writeFile(path.join(root, 'slugs.json'), JSON.stringify(['y', 'z']));
  await build('one-raw-page-removed', ['a/index.html', 'b/index.html', 'cached/y/index.html', 'cached/z/index.html'], /color:(?:#00f|blue)/,
    ['a/index.html', 'b/index.html', 'cached/y/index.html', 'cached/z/index.html', 'team/index.html']);
  await fs.writeFile(path.join(root, 'slugs.json'), '[]');
  await build('raw-pages-removed', ['a/index.html', 'b/index.html'], /color:(?:#00f|blue)/,
    ['a/index.html', 'b/index.html', 'team/index.html']);
  assert.equal((await fs.readdir(path.join(root, 'dist/_astro'))).some(p => p.endsWith('.png')), false,
    'An image used only by Image must still have its unused original removed');
  console.log('PASS: repeated builds, concurrent pages, old cache migration, Sass changes, image changes, original cleanup');
} finally {
  await fs.writeFile(path.join(root, 'results.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(`Build evidence: ${path.relative(here, root)}`);
}
