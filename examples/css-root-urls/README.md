# Bundle CSS while keeping root image and font URLs

Use this when relative CSS imports should be combined, but URLs such as `/images/epic.png` and `/fonts/example.woff2` are served by your website. [esbuild issue #4530](https://github.com/evanw/esbuild/issues/4530) demonstrates how `--external:/*` also keeps relative CSS imports outside the bundle.

This follows esbuild's [documented matching rules](https://esbuild.github.io/api/#external): external patterns are checked against both the original import and the resolved absolute file path. On Unix, `/*` therefore matches local files after resolution too.

## Known resource directories: use the CLI

Replace `/*` with your actual public asset directories:

```sh
esbuild a.css --bundle '--external:/images/*' '--external:/fonts/*' --outfile=dist/bundle.css
```

This combines `@import "b.css"` and preserves the image/font URL values. Do not retain the old `--external:/*` flag alongside these options. Keep patterns narrow: if a source file's absolute filesystem path also matches one of them, that file will still be external.

## Any root CSS URL: use the JavaScript API

Copy [css-root-urls.mjs](css-root-urls.mjs) beside your build script, then add its configuration:

```js
import * as esbuild from 'esbuild';
import { cssRootUrls } from './css-root-urls.mjs';

await esbuild.build({
  entryPoints: ['a.css'],
  bundle: true,
  outfile: 'dist/bundle.css',
  plugins: [cssRootUrls],
});
```

The configuration uses [onResolve](https://esbuild.github.io/plugins/#on-resolve) to preserve paths beginning with `/` only in CSS `url()` and `@import`. It runs before filesystem resolution. Relative CSS imports continue to bundle, and absolute JavaScript imports and entry points keep their normal behavior. Root CSS `@import` statements remain external; the web server must supply them.

Remove `external: ['/*']`. Retain any other intentional external settings, and add this plugin before another resolver that handles these paths. Relative assets still need your normal loaders. This example handles ordinary files in esbuild's `file` namespace; custom virtual namespaces may need their own resolver. The plugin requires the asynchronous JS API, not `buildSync` or the CLI.

## Run the complete example

Download [the source and tests ZIP](https://raw.githubusercontent.com/tevinch/data-shape-kit/css-root-urls-v1/downloads/css-root-urls-v1.zip), extract it and enter its directory. With Node.js 18 or newer:

```sh
npm ci --ignore-scripts
npm test
npm run build
```

The example pins esbuild 0.28.2. Inspect `dist/bundle.css`: it contains the imported font declaration, `.message`, the nested screen rule and `.card`, while retaining the root URL query/fragment values. The image and font files deliberately are not included; your website continues serving them.

Four scripted tests passed on Node.js 24.19.0 / macOS. They check completed CSS output and metadata, CLI builds from two directories, actual resolver calls, JavaScript imports, relative asset emission, intentional external imports and missing-file errors. With the original `/*` configuration, the relative-import assertions fail. Windows execution and browser rendering were not tested; this is a configuration recipe, not a core esbuild patch.

## Optional coffee

If this saves you some time and you'd like to buy me a coffee, thank you. It is entirely optional; the example, tests and guide are free.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
