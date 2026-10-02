import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { rollup } from 'rollup';
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';

const baseline = process.env.CORE_JS_BASELINE === '1';
const entry = fileURLToPath(new URL('entry.mjs', import.meta.url));
const names = ['isExtensible', 'isFrozen', 'isSealed', 'getPrototypeOf'];

async function bundle({ keep = false, treeshake = true, cache } = {}) {
  const plugins = [nodeResolve(), commonjs()];
  if (keep) {
    const { keepCoreJsChecks } = await import('./keep-core-js-checks.mjs');
    plugins.push(keepCoreJsChecks());
  }
  const build = await rollup({ input: entry, plugins, treeshake, cache });
  try {
    const { output: [{ code }] } = await build.generate({ format: 'cjs' });
    return { code, cache: build.cache };
  } finally {
    await build.close();
  }
}

function run(code, olderNatives = false) {
  const context = vm.createContext({ exports: {} });
  if (olderNatives) {
    vm.runInContext(`
      globalThis.probes = {};
      for (const name of ${JSON.stringify(names)}) {
        const original = Object[name];
        probes[name] = 0;
        Object[name] = function(value) {
          if (value !== Object(value)) {
            probes[name]++;
            throw new TypeError('simulated primitive rejection: ' + name);
          }
          return original(value);
        };
      }
    `, context);
  }
  vm.runInContext(code, context);
  const detectionCalls = olderNatives ? { ...context.probes } : null;
  return {
    detectionCalls,
    primitives: () => Array.from(vm.runInContext('exports.primitiveResults()', context)),
    objects: () => Array.from(vm.runInContext('exports.objectResults()', context)),
    operation: name => vm.runInContext(`Object.${name}(1)`, context),
  };
}

test('4.64.0 default retains real core-js primitive detection calls', async () => {
  const result = run((await bundle({ keep: false })).code, true);
  for (const name of ['isExtensible', 'isFrozen', 'isSealed']) {
    assert.ok(result.detectionCalls[name] > 0, name);
    assert.doesNotThrow(() => result.operation(name));
  }
});

test('preserves actual CommonJS detection and completes primitive and object operations', async () => {
  const { code, cache } = await bundle();
  const result = run(code, true);
  for (const name of names) assert.ok(result.detectionCalls[name] > 0, `${name} detection ran`);
  assert.deepEqual(result.primitives(), [false, true, true, true]);
  assert.deepEqual(result.objects(), [true, false, false, false, true, true, true]);
  assert.deepEqual(result.primitives(), [false, true, true, true]);
  const modules = cache.modules.filter(m => /[/\\]node_modules[/\\]core-js[/\\]/.test(m.id));
  assert.ok(modules.length > 50, 'real core-js dependency graph loaded');
  assert.ok(modules.some(m => m.code.includes('hasRequired')), 'CommonJS conversion ran');
  assert.ok(modules.every(m => m.moduleSideEffects !== 'no-treeshake'), 'no preservation hook ran');
});

test('keeps normal native behavior and still removes unused application code', async () => {
  const selective = await bundle();
  const all = await bundle({ keep: false, treeshake: false });
  assert.deepEqual(run(selective.code).primitives(), [false, true, true, true]);
  assert.deepEqual(run(selective.code).objects(), [true, false, false, false, true, true, true]);
  assert.deepEqual(run(all.code, true).primitives(), [false, true, true, true]);
  assert.ok(!selective.code.includes('UNUSED_APPLICATION_SENTINEL'));
  assert.ok(all.code.includes('UNUSED_APPLICATION_SENTINEL'));
  assert.ok(selective.code.length < all.code.length);
});

test('preservation survives a rebuild using the actual Rollup cache', async () => {
  const first = await bundle();
  const second = await bundle({ cache: first.cache });
  const result = run(second.code, true);
  assert.deepEqual(result.primitives(), [false, true, true, true]);
  for (const name of names) assert.ok(result.detectionCalls[name] > 0, name);
});
