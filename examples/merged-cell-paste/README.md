# Merged-cell paste

A small patch for **prosemirror-tables 1.8.5** that fixes a paste crash when the resulting selection ends inside a cell spanning multiple rows. The pasted content and merged-cell structure are retained. A runnable fixture checks both runtime formats and the actual **Tiptap 3.31.3 TableKit** paste path.

[Download source, patch and checks](../../downloads/merged-cell-paste-v0.1.0.zip?raw=true) · [Inspect the patch](patches/prosemirror-tables+1.8.5.patch) · [Reported problem](https://github.com/ueberdosis/tiptap/issues/7949)

## Try the regression fixture

Use **Node.js 24.15.0+ (24.x) or 26+** and Git; tested with Node.js 24.19.0. Extract the ZIP, enter its `merged-cell-paste` directory, then run:

```sh
npm ci --ignore-scripts
npm test
```

The test command checks the exact original dependency version and source hashes, copies dependencies into its own temporary directory, patches that copy, runs the checks, then removes the temporary copy. It leaves your installed dependencies unchanged. Dependency installation needs the npm registry; the tests themselves make no network requests.

To see the original failure with the same behavioral expectations:

```sh
npm run reproduce
```

This command intentionally exits nonzero on the unmodified dependency. The failing cases should report the merged-cell selection error, while ordinary paste controls pass. This fixture is an independent verification project; passing it does not apply the patch to your application.

## Apply it to an application

First inspect the versions **actually resolved by your editor**, including transitive dependencies:

```sh
npm ls prosemirror-tables @tiptap/core @tiptap/extension-table
```

This patch targets the unmodified `prosemirror-tables@1.8.5` files at `node_modules/prosemirror-tables`. Use it only when that is the copy your editor loads. If your tree contains another version or a nested copy, resolve that difference and test your application before applying this patch; adding a direct dependency alone does not ensure every consumer loads it.

Copy `patches/prosemirror-tables+1.8.5.patch` from the download into your application's `patches` directory. From the **application Git repository root**, where `node_modules/prosemirror-tables` is installed:

```sh
git apply --check patches/prosemirror-tables+1.8.5.patch
git apply patches/prosemirror-tables+1.8.5.patch
```

If the check fails, stop and inspect the resolved version or existing modifications. Rebuild your application and test its paste behavior. Reinstalling dependencies overwrites manual edits. To keep the patch across installations, an application using npm may choose [patch-package's documented setup](https://github.com/ds300/patch-package#usage) and commit this patch; configure that lifecycle explicitly in the application. This fixture does not add installation hooks or change your application scripts.

## What changes

Paste this table with the cursor inside an existing table:

```html
<table>
  <tr><td>A</td><td>B</td><td rowspan="2">C</td></tr>
  <tr><td>D</td><td>E</td></tr>
</table>
```

In the unmodified version, insertion reaches the final `CellSelection`, but its bottom-right endpoint can point to the end of a row rather than to the cell covering that grid position. The patch uses the actual cell offsets for the two selection endpoints:

```js
tr.doc.resolve(tableStart + map.map[top * map.width + left])
tr.doc.resolve(tableStart + map.map[(bottom - 1) * map.width + right - 1])
```

The insertion-boundary calls to `positionAt` remain unchanged. The patch does not add temporary columns or replace the clipboard handler. Existing cell-selection clipping and table-growth behavior continue to apply: pasting into a one-cell `CellSelection` still clips to that selection; a cursor inside a cell allows the pasted rectangle to extend from it.

Both shipped runtime files, `dist/index.js` and `dist/index.cjs`, are patched. The stale `sourceMappingURL` comment in the ESM file is removed because its original mapping no longer matches the edited code. Debuggers therefore use the edited ESM JavaScript. The CommonJS file has no mapping comment to remove. The package ships no corresponding TypeScript source file to patch.

## Verification and limits

Checks compare document content, span attributes, table dimensions and selection geometry. They cover ordinary paste, rowspan, combined rowspan/colspan, colspan controls, a merged cell with another cell to its right, offset placement, table growth, full and single-cell selections, headers, repeated paste, and synthetic wrapped HTML through Tiptap's parser. The fixtures use real ProseMirror state/paste APIs and real Tiptap `Editor.view.pasteHTML`.

The headless integration uses **jsdom 30.0.1** and a supplied synthetic DOM paste event. It does not exercise an operating-system clipboard, browser layout, or a real Excel/Google Sheets copy. In this default Tiptap schema, the tested `google-sheets-html-origin` wrapper with a style element reaches the same selection failure; this patch needs no separate wrapper-stripping step. Custom schemas, custom clipboard handlers and unrelated merged-cell behavior require their own checks.

The original demand is [Tiptap #7949](https://github.com/ueberdosis/tiptap/issues/7949). This is a separate, version-pinned workaround and regression fixture, with no claim of an accepted upstream fix. [MIT licensed](LICENSE), retaining the ProseMirror authors' notice.

## Buy me a coffee, if this helped

If this saved you some time, you're welcome to buy me a coffee. Please don't feel obliged — the code stays free, and useful feedback is welcome too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please match the asset and network exactly. Fees depend on your wallet or exchange. Thank you! — Tevinch
