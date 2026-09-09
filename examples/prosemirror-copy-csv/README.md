# Copy selected table cells as CSV

A small ProseMirror helper and optional React control for copying a **selected rectangle of table cells**. It addresses the output requested in [Docmost #2394](https://github.com/docmost/docmost/issues/2394): selecting the Age and City cells for Alice and Bob produces:

```csv
32,Berlin
28,Paris
```

This is an independent application example. It has been checked with real ProseMirror tables and selections through `@tiptap/pm` 3.31.3. It is not an installed Docmost feature or an upstream patch, and the full Docmost application has not been run here.

## Use the helper

Copy [selection-csv.mjs](selection-csv.mjs), [selection-csv.d.mts](selection-csv.d.mts), and [LICENSE](LICENSE) into your application. Keep the declaration beside the module.

```ts
import { selectionToCsv } from './selection-csv.mjs';

const csv = selectionToCsv(editor.state.selection);
if (csv !== undefined) {
  // Pass the CSV to your own download or explicit copy control.
  console.log(csv);
}
```

The helper imports `CellSelection` and `TableMap` from your existing `@tiptap/pm/tables`. Use the same installed package instance as the editor; do not add a separate ProseMirror version. A plain ProseMirror application can change that import to its existing `prosemirror-tables` package and the declaration imports to its existing `prosemirror-model` and `prosemirror-state` packages. That alternate setup has not been tested here.

Only an actual `CellSelection` is exported. A text cursor or ordinary text selection returns `undefined`. The helper neither expands the selection to the whole table nor includes an unselected header.

## Add an explicit copy control

Copy [copy-selected-csv.tsx](copy-selected-csv.tsx) beside the helper. In a React application that already owns a Tiptap editor:

```tsx
import CopySelectedCsv from './copy-selected-csv';

<CopySelectedCsv getSelection={() => editor.state.selection} />
```

Mount the control in a persistent toolbar or panel next to the editor. It reads the selection when clicked and prevents mouse-down from moving editor focus. It writes plain text only after **Copy as CSV** is clicked. Successful and failed writes both leave a labeled, read-only output available for inspection. If the clipboard API is unavailable or permission is refused, **Select output** supports manual copying. Repeated clicks cannot start another write while one is pending.

Keep the output panel available when it receives focus. If adapting this for a temporary bubble menu, place the manual-copy output outside a menu that closes on blur. Style and translate the native controls to match the host application.

In the [inspected Docmost table selection menu](https://github.com/docmost/docmost/blob/6205bbeb908fe846f87dd6a2cbf562e24777db38/apps/client/src/features/editor/components/table/table-cell-menu.tsx), the existing `editor` prop provides `editor.state.selection`. That is a possible integration point for an action backed by this helper; a complete Docmost menu integration remains application work.

## CSV behavior

- Uses commas and CRLF between records, with no final record separator. It quotes empty cells and cells containing commas, quotes or line breaks, doubling internal quotes.
- Preserves strings, leading zeros, whitespace, Unicode, paragraph breaks and hard breaks. It does not infer numbers or evaluate formulas. Text formatting is omitted.
- Writes merged-cell text once, at its top-left position, and leaves covered positions empty. A merged cell whose top-left lies outside the selected rectangle contributes no text. CSV cannot represent merged geometry.
- Rejects malformed table geometry, nested tables and embedded non-text atoms such as images. It does not silently turn those objects into missing text.
- Limits a selection to 1,000 rows, 64 columns and 100,000 UTF-16 code units of serialized CSV, including quotes and separators. It rejects oversized output instead of truncating it.
- Reads editor state without changing the document or selection. The helper makes no network, storage or clipboard calls; the optional React control only writes the generated CSV to the clipboard after a click.

The React textarea follows browser line-ending normalization, so manually copied output may use LF record separators. Quoted cell line breaks remain valid CSV. Formula-looking text remains unchanged: spreadsheet applications can interpret it as formulas when importing CSV. CSV quoting does not neutralize formulas; apply the destination application's policy when handling untrusted content.

For custom content, provide an explicit plain-text serializer:

```ts
const csv = selectionToCsv(editor.state.selection, {
  readCell(cell, { row, column }) {
    // row and column are 1-based positions within the selected rectangle.
    return cell.textBetween(0, cell.content.size, '\n');
  },
});
```

That example deliberately extracts text only. Replace it with the application's desired representation of attachments, mentions and other custom nodes. Supplying `readCell` replaces the default unsupported-content checks; it must return a string and should not change editor state.

`SelectionCsvError` exposes `code`, `row` and `column`. Codes are `MALFORMED_TABLE`, `UNSUPPORTED_CONTENT`, `MAX_ROWS`, `MAX_COLUMNS` and `MAX_CHARS`. Coordinates are relative to the selection; whole-selection errors use row 1, column 1. Invalid options or a non-string serializer result throw `TypeError`.

## Check the example

From this directory in a repository checkout, using Node.js 20 or newer:

```sh
npm install --ignore-scripts
npm test
npm run typecheck
```

The test setup installs common libraries for this example, including `@tiptap/pm` 3.31.3 and React 19.2.8. The 29 tests exercise real document selections, reverse selection order, merged cells, CSV escaping, empty cells, bounds, click-time selection, clipboard rejection, manual fallback, duplicate-click handling and fixed error messages. The clipboard boundary is mocked in the UI tests. No Docmost server, database or user documents are needed.

A local Chrome check also exercised an editable ProseMirror table with synthetic values: normal and reverse selections, native clipboard-write success, quoted values, clearing a previous result after switching to a text cursor, and complete manual output when a browser permissions policy denied clipboard writing. These checks cover the independent example, not the full Docmost interface.

## Optional coffee

This solution is free under the MIT license. If it saves you some time and you feel like buying me a coffee, thank you — it is entirely optional.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please match the asset and network exactly. Transfer and withdrawal fees depend on your wallet or exchange.
