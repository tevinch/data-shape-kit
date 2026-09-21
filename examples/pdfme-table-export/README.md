# Export a PDF when a shrinking table overlaps another element

**Update — 22 September 2026:** [PDFme 6.1.13](https://github.com/pdfme/pdfme/releases/tag/6.1.13) includes the official shrinking-table fix from [PR #1599](https://github.com/pdfme/pdfme/pull/1599). Prefer the official release and remove this temporary patch command when upgrading. Keep the related PDFme packages on matching versions and review your exported PDFs: the same release also changes table row-height calculations. The checks below describe the older 6.1.12 patch, not a fresh test of 6.1.13.

In PDFme 6.1.12, a dynamic table can shrink enough to move a following element above the page's content area. The resulting negative page index stops `generate()` with a `reading 'push'` error.

This example applies and checks the one-line guard suggested by **abdulrahim-tero** in [pdfme/pdfme#1598](https://github.com/pdfme/pdfme/issues/1598). The added material is an exact-version installer and a reproducible PDF verification workflow. The original saved template does not need to be rewritten.

## Try it

Use Node.js 22.18 or newer, npm and Git. Verification here used Node.js 24.19.0 on macOS.

[Download the example ZIP](../../downloads/pdfme-table-export-v0.1.0.zip), or clone the repository:

```sh
git clone https://github.com/tevinch/data-shape-kit.git
cd data-shape-kit/examples/pdfme-table-export
npm ci --ignore-scripts
node apply-patch.mjs --check
node apply-patch.mjs
npm run verify
```

To see the failure first, run `node verify-workflow.mjs` after `npm ci` and before applying the patch. It fails during the first PDF export on the unmodified package. The same command passes after patching.

Verification generates actual PDFs and reopens them with PDF.js. It checks a one-row overlapping table, an empty table, an ordinary non-overlapping layout, 70 rows split across pages, and two consecutive inputs. Every data cell and caption must survive; the ordinary following caption must still move upward when its table shrinks. Saved templates and inputs must remain unchanged. PDFs and results are written to `.checks/` for inspection.

## Apply it to an application

Review [the runtime patch](patches/common-6.1.12.patch) and [the source patch](patches/source.patch). In the application's directory:

```sh
npm install --save-exact @pdfme/common@6.1.12 @pdfme/generator@6.1.12 @pdfme/schemas@6.1.12
node /absolute/path/to/pdfme-table-export/apply-patch.mjs . --check
node /absolute/path/to/pdfme-table-export/apply-patch.mjs .
```

Use your existing template, inputs and plugins. Tables need the table plugin explicitly:

```js
import { generate } from '@pdfme/generator';
import { text, table } from '@pdfme/schemas';

const bytes = await generate({ template, inputs, plugins: { text, table } });
```

The installer targets a regular npm installation at `node_modules/@pdfme/common`. It checks the package version and exact runtime SHA-256 before writing, then verifies the patched bytes. A repeated application is a no-op. Modified dependencies, linked packages, pnpm stores and Yarn Plug'n'Play are unsupported. Reapply after reinstalling dependencies; restore the original package with `npm ci` using your saved lockfile.

The source patch applies to `packages/common/src/dynamicTemplate.ts` at upstream commit [`4961a369`](https://github.com/pdfme/pdfme/tree/4961a3699db7fcf55bbad6beeac6335cff422268). In that checkout, run `git apply --check /path/to/source.patch` before `git apply /path/to/source.patch`. This is the historical temporary patch for 6.1.12; use the official 6.1.13 fix above when upgrading.

## Layout scope

The guard keeps the calculated page index at zero or above. An over-shifted element lands at the first page's content boundary, matching the existing clamp for its vertical position. In the overlapping example, the caption moves above the table. Normal table shrinking and pagination continue to use PDFme's existing layout rules.

This does not redesign the placement of side-by-side or overlapping elements. Review your generated PDFs for intentional overlaps. Other PDFme versions, custom plugins, Designer interactions and the full upstream test suite have not been verified.

## License

The fixture, verification code and installer use the [MIT license](LICENSE). The patches retain PDFme's [upstream license](UPSTREAM-LICENSE). Keep both when sharing.

## Optional coffee

If this saves you some time, you're welcome to buy me a coffee. The code is free, and any support is entirely optional.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
