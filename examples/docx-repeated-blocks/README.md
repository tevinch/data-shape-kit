# DOCX repeated block replacement

This exact-version patch fixes `docx` 9.7.1 `patchDocument` calls where the same `PatchType.DOCUMENT` key appears in separate paragraphs. The published Node entrypoints collect all matching paragraph paths, then mutate them from the start of the document; when a replacement changes the number of siblings, later cached paths can delete intervening author content or replace the wrong block. The patch visits DOCUMENT paths in descending document order. Existing `PatchType.PARAGRAPH` traversal and the public API stay unchanged.

[Download the v0.1.0 source, patch, and checks](../../downloads/docx-repeated-blocks-v0.1.0.zip?raw=true) · [Inspect the patch](patches/docx+9.7.1.patch)

## Run the fixture

Use Git and Node.js 24.19.0. Extract the ZIP, enter its `docx-repeated-blocks` directory, and run these three commands:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run reproduce
```

`npm test` verifies pristine `docx` 9.7.1 source hashes, copies the local dependency installation to a temporary directory, checks and applies the patch there, and runs 46 generated real-DOCX scenarios through the ESM and CommonJS entrypoints. It removes the copy and verifies that the original installed files remain pristine. The dependency installation needs the npm registry; the checks themselves make no network requests.

`npm run reproduce` intentionally retains the unmodified test runner's nonzero exit. On Node.js 24.19.0 with the pinned dependencies, it reports 14 passing controls and 32 failed assertions. In the first case, the expected sequence includes `HEADING TWO`, while stock output loses it and inserts a third replacement block. With `recursive: false`, stock output is `X, Y, X, Y, {{ph}}` instead of `X, Y, MIDDLE, X, Y`.

## Apply the patch in an application

The patch targets only these pristine published files from `docx` 9.7.1:

- `node_modules/docx/dist/index.cjs`
- `node_modules/docx/dist/index.mjs`

Copy `patches/docx+9.7.1.patch` into your application's `patches` directory and pin `"docx": "9.7.1"` in its `package.json` and lockfile. From the application repository root, install the locked dependencies, inspect the resolved version, then check and apply the patch:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm ls docx
git apply --check patches/docx+9.7.1.patch
git apply patches/docx+9.7.1.patch
```

If the check fails, stop and inspect the installed version, resolved package location, and any existing source modifications. Reinstalling dependencies overwrites manual changes. Applications may persist the patch with their package manager's documented patch workflow; this fixture deliberately adds no install or lifecycle hook.

Your existing `patchDocument` call keeps the same shape:

```js
import { Document, Packer, Paragraph, patchDocument, PatchType } from "docx";

const template = await Packer.toBuffer(new Document({
  sections: [{
    children: [
      new Paragraph("HEADING ONE"),
      new Paragraph("{{section}}"),
      new Paragraph("HEADING TWO"),
      new Paragraph("{{section}}"),
    ],
  }],
}));

const output = await patchDocument({
  data: template,
  outputType: "nodebuffer",
  patches: {
    section: {
      type: PatchType.DOCUMENT,
      children: [new Paragraph("INSERTED"), new Paragraph("tail")],
    },
  },
});
```

Each DOCUMENT placeholder occupies and replaces a whole paragraph. This change preserves siblings around separate placeholder paragraphs; it does not preserve prefix or suffix text inside the paragraph being replaced.

## Verification and limits

The suite generates DOCX archives and parses the resulting OOXML instead of simulating the replacement algorithm. In both Node module formats it checks two and three occurrences, adjacent occurrences, zero/one/multiple replacement children, `recursive` true and false, custom delimiters, split formatted runs, distinct keys, top-level table siblings, separate and nested table cells, table replacements, headers, footers, Unicode, paragraph and run styles, actual image bytes and relationships, actual hyperlink targets, single/no-match controls, and repeated PARAGRAPH behavior. The verifier also rejects a wrong package version and either modified entrypoint before applying anything, retains child/spawn/cleanup failures, and post-checks the source installation.

The fixtures are generated examples; the reporter's original template was not available. Coverage does not establish behavior for every Word layout, textboxes, same-paragraph DOCUMENT semantics, browser/UMD bundles, or unrelated `patchDocument` defects. This is an adoption patch for the exact published Node files above and has not been accepted upstream.

[mrobst](https://github.com/dolanmiu/docx/issues/3504) identified the stale-path problem and proposed processing matches in reverse order. The patch implements that proposal for DOCUMENT replacements only. The upstream code retains the full Dolan MIT notice in [LICENSE](LICENSE), with the fixture and ordering additions also released under MIT.

## Buy me a coffee, if this helped

If this saved you some time, you're welcome to buy me a coffee. Please don't feel obliged—the patch stays free, and useful feedback is welcome too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please match the asset and network exactly. Fees depend on your wallet or exchange. Thank you! — Tevinch
