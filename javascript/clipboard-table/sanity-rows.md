# Spreadsheet paste for Sanity-shaped rows

The open [Sanity table request #1060](https://github.com/sanity-io/plugins/issues/1060) asks for spreadsheet paste to fill rows and columns. The plugin's [row model and update code](https://github.com/sanity-io/plugins/blob/9e4161f76a29071cf3bb02fb88475d734e90831a/plugins/@sanity/table/src/components/TableComponent.tsx) use `_key`, `_type` and `cells: string[]`; its [cell input](https://github.com/sanity-io/plugins/blob/9e4161f76a29071cf3bb02fb88475d734e90831a/plugins/@sanity/table/src/components/TableInput.tsx) currently handles individual changes. These links pin the source inspected on September 9, 2026.

[`applyGridPaste`](sanity-rows.mjs) supplies the data transformation: overlay a parsed rectangle at a zero-based row/column origin, keep existing row keys and properties, grow the table when needed, and fill new space with empty strings. It returns new rows and leaves the input unchanged. This is an independent MIT-licensed helper, not an installed Sanity plugin or a shipped Studio fix. It makes no network requests and sends no patches.

## Run a small example

Copy [`index.mjs`](index.mjs), [`sanity-rows.mjs`](sanity-rows.mjs) and [`LICENSE`](LICENSE) into one directory. Save this as `check.mjs` there and run `node check.mjs` with Node.js 22 or newer:

```js
import assert from 'node:assert/strict';
import { parseClipboard } from './index.mjs';
import { applyGridPaste } from './sanity-rows.mjs';

const rows = [
  { _key: 'a', _type: 'tableRow', cells: ['A1', 'A2'] },
  { _key: 'b', _type: 'tableRow', cells: ['B1', 'B2'] },
];
const before = JSON.stringify(rows);
const block = parseClipboard('00123\t"first\nsecond"\r\n00456\t\r\n');
const next = applyGridPaste(rows, block, 1, 1, {
  rowType: 'sizeRow',
  createKey: () => 'new-row', // fixed only because this example adds one row
});
assert.deepEqual(next, [
  { _key: 'a', _type: 'tableRow', cells: ['A1', 'A2', ''] },
  { _key: 'b', _type: 'tableRow', cells: ['B1', '00123', 'first\nsecond'] },
  { _key: 'new-row', _type: 'sizeRow', cells: ['', '00456', ''] },
]);
assert.equal(JSON.stringify(rows), before);
console.log('Offset paste, multiline text, empty cells and original rows verified.');
```

For repeated pastes, pass your application's unique-key factory, such as the plugin's existing `uuid` function. The helper calls it only for new rows and rejects duplicate or blank keys. Pass the plugin's configured `rowType`; existing row types stay unchanged. TypeScript users can copy [`sanity-rows.d.mts`](sanity-rows.d.mts) and [`index.d.mts`](index.d.mts) beside the modules.

## Contract

`applyGridPaste(rows, block, startRow, startColumn, options?)` accepts rectangular string grids. All pasted rows are data; no header is removed or interpreted. Empty pasted cells overwrite the corresponding cells. Text, spaces, leading zeros and formula-looking strings remain strings. Row metadata is copied shallowly; each returned row and `cells` array is new.

The origin may be inside the existing grid or exactly at its bottom/right edge. An empty destination starts at `(0, 0)`. Gaps beyond the current edges, ragged grids, missing keys/types and non-string cells are rejected. Default **result** limits are 10,000 rows and 256 columns; `maxRows` and `maxColumns` can override them with positive safe integers. The parser's separate input-length limit still applies when using `parseClipboard`. Invalid data/options throw `TypeError`; invalid origins or exceeded result limits throw `RangeError`. An error returns no partial result and does not change existing rows.

## Wiring it into an input

Read `text/plain` from the cell's [paste event](https://developer.mozilla.org/en-US/docs/Web/API/Element/paste_event) before the browser inserts it. Route the event with the focused row's `_key` and column position; resolve that key against the current rows when computing the paste. Keep ordinary single-cell paste behavior when the parsed input is one ordinary cell. When taking over a grid paste, call `preventDefault()`, catch parsing/shape/limit errors and display them without applying a partial change. Honor the input's `readOnly` state.

The returned array is a local calculation, not a concurrency strategy. Sanity recommends [fine-grained patches](https://www.sanity.io/docs/studio/from-input-components-to-real-time-safe-patches); setting an entire locally computed rows array can overwrite another editor's concurrent changes. The Studio adapter still needs keyed patches, deliberate row/column growth behavior, focus/error feedback and tests for editing or reordering during a paste. Plain string cells use column positions, so concurrent column changes also need an explicit policy.

The helper's 16 tests cover offsets, growth, row metadata, parser integration, empty cells, limits, invalid keys and unchanged inputs on failure. Run them from a checkout with `node --test javascript/clipboard-table/sanity-rows.test.mjs`. Live Studio editing, collaborative patches and cross-spreadsheet interoperability have not been tested here. XLSX files, HTML tables and formatting are outside this helper's scope.

## Buy me a coffee, if this helped

If this saved you a little time, you're welcome to buy me a coffee. Please don't feel obliged — the code stays free, and a useful test case is appreciated too.

- **USDC on Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC on Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Match the asset and network exactly. Fees depend on your wallet or exchange. Thank you! — Tevinch
