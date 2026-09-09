# PapaParse Worker checks for Vite 8

A free configuration solution and a runnable check page for PapaParse's built-in Worker path in Vite production builds. [PapaParse issue #1122](https://github.com/mholt/PapaParse/issues/1122) reports a particularly misleading failure: the number of rows looks plausible, but the rows are `null` and data arrays appear in `meta.fields`.

An independent two-row reproduction confirmed that behavior with the reported dependency versions. In that reproduction, changing Vite's minifier to Terser preserved both the Worker path and correct results. Disabling minification also worked. Updating dependencies alone did not fix the tested case.

The issue already includes an [esbuild workaround](https://github.com/mholt/PapaParse/issues/1122#issuecomment-4968221696), and [upstream PR #1145](https://github.com/mholt/PapaParse/pull/1145) proposes a strict-mode fix. That PR was still open when checked on September 10, 2026. This guide adds a version-pinned Terser comparison and runnable result checks for the released packages below. Recheck the upstream release status before changing an application's configuration.

## Copy the configuration

Install the minifier in your Vite project:

```sh
npm install --save-dev --save-exact terser@5.51.2
```

Add `minify` under the existing `build` object in `vite.config.js` or `vite.config.ts`. Preserve your framework plugins and other settings:

```js
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    minify: 'terser',
  },
});
```

Rebuild and test the production output with the same CSV input. The option belongs to **`build.minify`** because PapaParse creates its own Worker from bundled code. This example does not use a Vite-managed Worker entry. Vite documents both the [minifier selection and the required separate installation](https://vite.dev/config/build-options.html#build-minify).

This changes the minifier for the application's JavaScript build. Check your complete application and measure its build time and output size before adopting it. For diagnosis, `build: { minify: false }` is another useful comparison, with a larger uncompressed bundle. Keeping `worker: true` avoids moving the parse back onto the UI thread.

## What was verified

On September 10, 2026, a Chrome production-build comparison used the same generated CSV containing two rows, including identifier `00123`:

| Vite / PapaParse | Default minification, Worker | Minification disabled, Worker | Terser 5.51.2, Worker |
| --- | --- | --- | --- |
| 8.0.14 / 5.5.3 | Two null rows; row arrays appended to `meta.fields` | Correct rows and headers | Correct rows and headers |
| 8.2.2 / 5.7.0 | Worker exception mentioning `skipEmptyLines`; no completion within four seconds | Correct rows and headers | Correct rows and headers |

The non-Worker control returned the expected rows in all six builds. The first dependency pair follows the [reported reproduction](https://github.com/milachae/papaparse-worker-test); the second was current when checked. No Vue or React dependency was needed in the independent reproduction.

For this tiny reproduction, the generated JavaScript sizes were approximately 20.66 / 27.93 / 20.82 kB for the first row of the table, and 20.10 / 27.17 / 20.28 kB for the second, in default / unminified / Terser order. These are example bundle sizes, not general performance claims.

The comparisons isolate the observed behavior to the selected minification path for this reproduction. They do not establish which optimizer transformation causes it or prove that all Vite 8 Worker problems have the same cause. PapaParse's [5.7.0 source](https://github.com/mholt/PapaParse/blob/5.7.0/papaparse.js) builds its built-in Worker using a stringified factory function, which is relevant context for testing the emitted code instead of relying only on development mode.

## Run the check page

[Download the source ZIP](https://github.com/tevinch/data-shape-kit/raw/refs/heads/main/downloads/papaparse-vite-worker-v0.1.0.zip), extract it, and run these commands from its directory with Node.js 22.12 or newer:

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run preview
```

Open the local URL printed by Vite and select **Run 8 checks**. The default configuration in this example uses Terser. The source pins Vite 8.2.2, PapaParse 5.7.0 and Terser 5.51.2; verification used Node.js 24.19.0. `npm test` checks the fixtures and the result comparison in Node. **Only running the built page tests an actual browser Worker.**

The page checks four fixtures with Worker enabled and disabled:

- A downloaded CSV whose identifier must keep its leading zeros.
- Unicode, a quoted CRLF, escaped quotes and trailing empty cells.
- Array rows with an explicit semicolon delimiter.
- A UTF-8 BOM and non-ASCII header and value text.

A check passes only when its complete data and expected header fields match and no parse errors are reported. Unsupported Workers, exceptions and timeouts are failures. A timeout does not terminate PapaParse's internal Worker; reload the page before retrying.

To inspect other minification paths without overwriting the passing build:

```sh
npm run build:default
npm run preview -- --outDir dist-default
```

Or:

```sh
npm run build:unminified
npm run preview -- --outDir dist-unminified
```

Stop the previous preview process before starting the next, or use the new port Vite prints. Serve built output over HTTP; directly opening `index.html` from the filesystem is not supported by this example. The one downloaded fixture comes from the same local server. No real datasets, uploads or external runtime services are involved.

## Scope and reuse

The setup retains PapaParse's [normal parsing API](https://www.papaparse.com/docs), including `download: true` and `worker: true`. It is a tested configuration workaround, not a patched PapaParse release or a replacement parser. It does not address stream backpressure, chunk-boundary decoding, arbitrary custom callbacks, application CSP restrictions, or every supported browser. If the default minifier changes, rerun the comparison rather than assuming the workaround is still necessary.

The code and fixtures are original [MIT-licensed](LICENSE) examples. Vite generates `THIRD_PARTY_NOTICES.md` in each build for the bundled dependency notices. Keep that file when sharing built output.

## Buy me a coffee, if this helped

If this saved you a little time, you're welcome to buy me a coffee. Please don't feel obliged — the solution stays free, and a useful reproduction is appreciated too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please match the asset and network exactly. Fees depend on your wallet or exchange. Thank you! — Tevinch
