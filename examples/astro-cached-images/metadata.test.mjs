import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { test } from 'node:test';
import { collectPrerenderMetadata } from './node_modules/astro/dist/core/render-scope/collect.js';
import { installRenderScope, uninstallRenderScope } from './node_modules/astro/dist/core/render-scope/scope.js';
import { getProxyCode } from './node_modules/astro/dist/assets/utils/proxy.js';
import { IncrementalBuildCache } from './node_modules/astro/dist/core/build/incremental.js';

test('each concurrent render records shared and private raw references', async () => {
  installRenderScope(new AsyncLocalStorage());
  globalThis.astroAsset = { referencedImages: new Set() };
  const makeImage = name => Function(`return (${getProxyCode({src: `/_astro/${name}.png`, fsPath: `/src/${name}.png`, width: 64, height: 64, format: 'png'}, false)})`)();
  const shared = makeImage('shared');
  const one = makeImage('one');
  const two = makeImage('two');
  const logger = { warn() { throw new Error('Render scope must be installed'); } };
  try {
    const results = await Promise.all([one, two].map(image => collectPrerenderMetadata(async () => {
      shared.src;
      await Promise.resolve();
      image.src;
      shared.src;
    }, logger)));
    assert.deepEqual(results.map(r => r.metadata.referencedImages), [
      ['/src/shared.png', '/src/one.png'],
      ['/src/shared.png', '/src/two.png'],
    ]);
  } finally {
    uninstallRenderScope();
    delete globalThis.astroAsset;
  }
});

test('cache without raw reference metadata must render again', () => {
  const previous = { version: 1, configHash: 'config', lockfileHash: 'lock', keyDigest: 'key', routes: {
    'src/pages/[slug].astro': {dependencyHash: 'dep', paths: {'/x/': {cacheKey: 'v1', outputFile: 'x/index.html'}}},
  }};
  const cache = new IncrementalBuildCache('config', 'lock', 'key', new Map(), previous);
  assert.equal(cache.canSkip('src/pages/[slug].astro', '/x/', 'dep', 'v1'), false);
  previous.routes['src/pages/[slug].astro'].paths['/x/'].referencedImages = [];
  assert.equal(cache.canSkip('src/pages/[slug].astro', '/x/', 'dep', 'v1'), true);
});
