'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Metro = require('metro');
const { getDefaultConfig, mergeConfig } = require('metro-config');

async function main() {
  const variant = process.argv[2] || 'after';
  assert(['before', 'after'].includes(variant), 'Use before or after');
  const outputDirectory = path.join(__dirname, '.checks');
  fs.mkdirSync(outputDirectory, { recursive: true });
  const versions = Object.fromEntries(
    ['metro', 'metro-transform-plugins', '@babel/core', '@babel/traverse']
      .map(name => [name, require(name + '/package.json').version]),
  );
  console.log(JSON.stringify({ node: process.version, versions }));
  const defaults = await getDefaultConfig(__dirname);
  const results = [];
  for (const platform of ['ios', 'android']) {
    for (const dev of [true, false]) {
      const config = mergeConfig(defaults, {
        projectRoot: __dirname,
        watchFolders: [__dirname],
        maxWorkers: 1,
        resetCache: true,
        cacheStores: [],
        reporter: { update() {} },
        resolver: { useWatchman: false },
      });
      const options = { entry: variant + '.js', dev, minify: !dev, platform };
      const bundle = await Metro.runBuild(config, options);
      const name = [variant, platform, dev ? 'dev' : 'release'].join('-');
      fs.writeFileSync(path.join(outputDirectory, name + '.js'), bundle.code);
      const context = {};
      vm.runInNewContext(bundle.code, context, { timeout: 1000 });
      // Read the final bundle's observable result, outside any build callback.
      const actual = context.releaseValues && { ...context.releaseValues };
      const expected = {
        span: 14, increment: 81, label: 'off', renamed: 81,
        fromParameter: 81, twice: 160, production: !dev,
      };
      let failure;
      try {
        assert.deepEqual(actual, expected);
      } catch (error) {
        failure = error.message;
        process.exitCode = 1;
      }
      const row = { name, options, bytes: Buffer.byteLength(bundle.code), actual,
        passed: !failure, ...(failure ? { failure } : {}) };
      results.push(row);
      console.log(JSON.stringify(row, preserveNonFinite));
    }
  }
  fs.writeFileSync(path.join(outputDirectory, 'results-' + variant + '.json'),
    JSON.stringify({ node: process.version, versions, results }, preserveNonFinite, 2) + '\n');
}

function preserveNonFinite(_key, value) {
  return typeof value === 'number' && !Number.isFinite(value) ? String(value) : value;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
