# Preserve core-js compatibility checks with Rollup

**Update, 2026-10-03:** Rollup **4.64.0** includes the upstream correction in [PR #6541](https://github.com/rollup/rollup/pull/6541), and [issue #6538 is closed](https://github.com/rollup/rollup/issues/6538). Prefer upgrading and checking your final bundle. The temporary helper below is for projects that still use the affected older version.

Separate verification on 4.64.0, CommonJS plugin 29.0.3, node-resolve 16.0.3 and core-js 3.50.0 passed all four checks **without the helper**: actual primitive detections ran, repeated primitive/object operations completed, unused application code was removed, and a cached rebuild remained correct. The older-native case is a Node VM simulation, not a real older browser.

To rerun that verification from the current source directory in a disposable checkout:

```sh
npm ci --ignore-scripts
npm install --ignore-scripts --save-exact rollup@4.64.0
node --test test-current.mjs
```

The original `npm test` and versioned ZIP remain pinned to 4.63.5 and include a test that expects the old defect. Use `test-current.mjs` for the upgrade check. Remove the temporary helper from your own configuration only after testing your supported browsers and any downstream minifier.

## Older-version workaround

Rollup 4.63.5 can remove calls inside a feature-detection callback passed through a property, even with the default `tryCatchDeoptimization: true`. In the tested CommonJS build of core-js 3.50.0, this drops the primitive checks for `Object.isExtensible`, `Object.isFrozen` and `Object.isSealed`. An engine that throws for these primitive arguments can then keep its incompatible native implementation.

This temporary configuration keeps tree-shaking enabled for your application and disables it for the core-js modules included in the build. It uses Rollup's documented module flag; it does not patch Rollup or core-js. See the [original report](https://github.com/rollup/rollup/issues/6538).

## Add the configuration

Copy [keep-core-js-checks.mjs](keep-core-js-checks.mjs) beside your Rollup configuration, then put it after the CommonJS plugin:

```js
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { keepCoreJsChecks } from './keep-core-js-checks.mjs';

export default {
  input: 'src/index.js',
  plugins: [nodeResolve(), commonjs(), keepCoreJsChecks()],
  output: { file: 'dist/index.js', format: 'es' },
};
```

The entire configuration helper is:

```js
export function keepCoreJsChecks() {
  return {
    name: 'keep-core-js-checks',
    transform(code, id) {
      if (/[/\\]node_modules[/\\]core-js[/\\]/.test(id)) {
        return { code, map: null, moduleSideEffects: 'no-treeshake' };
      }
      return null;
    },
  };
}
```

`moduleSideEffects: true` alone still allows statements within a module to be removed. The string `'no-treeshake'` is the relevant [plugin hook result](https://rollupjs.org/plugin-development/#load). Do not return this string from the global `treeshake.moduleSideEffects` callback, whose documented result is boolean.

Keep your existing core-js imports. This does not load additional polyfills for you. Matching follows the resolved module ID: a `node_modules/core-js/` path segment is required. Vendored sources, aliases resolving elsewhere, Plug'n'Play layouts and `core-js-pure` need separate matching and verification. Put the helper after plugins that set `moduleSideEffects`; a later plugin can override it.

## Run the complete example

Download [source, configuration and tests](https://raw.githubusercontent.com/tevinch/data-shape-kit/core-js-checks-v1/downloads/core-js-checks-v1.zip), extract the ZIP and enter its directory. With Node.js 18 or newer:

```sh
npm ci --ignore-scripts
npm test
npm run build
node -e "console.log(require('./dist/example.cjs').primitiveResults())"
```

The last command prints `[ false, true, true, true ]`. The example imports the four Object modules and executes the resulting bundle. Versions are pinned to Rollup 4.63.5, CommonJS plugin 29.0.3, node-resolve 16.0.3 and core-js 3.50.0.

Four scripted checks passed on Node.js 24.19.0 / macOS. They compare the default build with the configuration, observe the actual feature-detection calls before application operations, verify CommonJS conversion and module flags, repeat primitive and object operations, check a cached rebuild, and confirm unused application code is still removed. Removing the helper makes two of these checks fail.

The older-native case uses a separate Node VM with Object methods that reject primitive arguments. It demonstrates the detection and replacement path; it is **not a run in a real older browser**. Modern native behavior is checked separately. Windows, other core-js versions, other bundlers and downstream minifiers were not tested. Validate your final production bundle on your supported browsers, especially if another tool optimizes it afterward.

Keeping all included core-js statements increases bundle size. Global `treeshake: false` is a broader fallback, but also keeps unused application code. This example checks that distinction; it does not claim a particular size saving for your app. After upgrading Rollup, rerun your compatibility checks and reassess this temporary configuration.

The example and helper are available under the repository's MIT license.

## Optional coffee

If this saves you some time and you'd like to buy me a coffee, thank you. It is entirely optional; the example, tests and guide are free.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
