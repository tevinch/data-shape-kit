# ExcelJS XLSX import compatibility

An exact-version patch and generated regression fixture for ExcelJS 4.4.0 imports that combine a plain leading text node with rich-text runs, or contain a worksheet name longer than 31 characters. It covers shared strings, inline strings and real hyperlink relationships without using the unavailable reporter workbook.

[Download the standalone source, patch and checks](../../downloads/xlsx-import-compat-v0.1.0.zip?raw=true) · [Inspect the patch](patches/exceljs+4.4.0.patch)

## Try the regression fixture

Use Node.js 24 and Git; tested with Node.js 24.19.0. Extract the ZIP, enter its `xlsx-import-compat` directory, then run:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm test
```

`npm test` verifies ExcelJS 4.4.0 and the SHA-256 hashes of the three original files. It copies the installed dependencies and test file into a temporary directory, confirms that ExcelJS and JSZip resolve only inside that directory, runs `git apply --check`, applies the patch, executes the real XLSX tests with the current Node executable, removes the temporary files and confirms that the installed ExcelJS sources did not change. The gate checks also prove that a wrong version and changed source are rejected before patching.

Dependency installation needs the npm registry. The verifier and tests make no network requests, and generated hyperlink fixtures use an `example.com` target without opening it.

Run the same expectations against the unmodified package:

```sh
npm run reproduce
```

That command intentionally exits nonzero. On the tested installation, the complete run has five passing scenarios and ten known failures: `SharedStringXform` and `CellXform` throw when a plain text node precedes a rich-text run, while the worksheet setter rejects its own truncated long name. The inline empty-prefix case already passes and remains covered. The original-mode verifier requires the complete scenario count, all stock controls and all three failure paths before labeling the run as the known reproduction. Missing dependencies, incomplete execution and unrelated results are fixture errors.

## Apply the patch to an application

From the application's Git repository root, first inspect the resolved version:

```sh
npm ls exceljs
```

The patch applies only to unmodified ExcelJS 4.4.0 files at:

- `node_modules/exceljs/lib/xlsx/xform/strings/shared-string-xform.js`
- `node_modules/exceljs/lib/xlsx/xform/sheet/cell-xform.js`
- `node_modules/exceljs/lib/doc/worksheet.js`

Copy `patches/exceljs+4.4.0.patch` into the application, inspect it, then run these commands from that application root:

```sh
git apply --check patches/exceljs+4.4.0.patch
git apply patches/exceljs+4.4.0.patch
```

If the check fails, stop and inspect the resolved package version, package location and existing modifications. Rebuild and test the application after applying the patch.

Reinstalling dependencies overwrites a manual edit. Applications can use [patch-package's documented setup](https://github.com/ds300/patch-package#usage) to persist a reviewed patch. Configure that lifecycle explicitly in the application; this fixture installs no hook.

## What changes

ExcelJS 4.4.0 stores a plain `<t>` value as a JavaScript string. When a following `<r>` arrives, both the shared-string and inline-string parsers try to add `richText` to that string. The patch first promotes the string to a rich-text value. A nonempty string becomes the first unformatted run; an empty string becomes no visible run. Existing formatted runs retain their order and formatting.

Long imported worksheet names keep ExcelJS's existing truncation to 31 characters. The duplicate-name predicate excludes the current worksheet while retaining case-insensitive rejection between distinct worksheets, including names that become equal only after truncation.

Rich-text hyperlink content remains nested inside `cell.value.text`, and `cell.text` can be an object rather than a primitive string. Read it defensively:

```js
const value = cell.value;
const content = value && typeof value === 'object' && 'hyperlink' in value ? value.text : value;
const text = content && typeof content === 'object' && Array.isArray(content.richText)
  ? content.richText.map(run => run.text).join('')
  : cell.text;
```

## Verification and limits

The 15 scenarios use actual `Workbook.xlsx.load` and `writeBuffer` calls. They cover shared and inline mixed strings with an empty prefix, Unicode and ampersands surrounded by spaces, and the string `0`; formatting and write/reload preservation; a combined mixed-string and long-name workbook; true post-truncation and case-insensitive collisions; rich-text-only, whitespace-preserving plain text, number and same-sheet cached-formula controls; ordinary and nested rich-text hyperlinks with real XLSX relationships; and a generated 12-sheet workbook containing 671 distinct mixed shared strings.

This patch targets only the three published Node `lib` files in ExcelJS 4.4.0. It does not update browser bundles, ES5 builds or the streaming reader. It does not rewrite formula references or defined names after truncation, so cross-sheet references to a long original name need review. It is not a general lossless workbook repair and does not claim compatibility outside the tested shapes and versions.

The original workbook reported in [ExcelJS issue 3079](https://github.com/exceljs/exceljs/issues/3079) and [issue 3080](https://github.com/exceljs/exceljs/issues/3080) is unavailable. Both reports are by IvesPei and concern the same workbook; the reporter supplied the diagnoses and proposed fixes. This fixture packages those source changes with generated regression coverage and application guidance. It does not claim upstream acceptance or verification against the original file.

The patched ExcelJS portions retain the upstream MIT notice for Copyright (c) 2014-2019 Guyon Roche. The fixture, packaging and guide additions are also MIT licensed; see [LICENSE](LICENSE).

## Buy me a coffee, if this helped

If this saved you some time, you're welcome to buy me a coffee. Please don't feel obliged — the code stays free, and useful feedback is welcome too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please match the asset and network exactly. Fees depend on your wallet or exchange. Thank you! — Tevinch
