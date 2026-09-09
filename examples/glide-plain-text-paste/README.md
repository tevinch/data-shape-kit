# Plain-text paste for Glide Data Grid

A small event adapter for applications that want to use the current native paste event's **plain text** instead of the grid's HTML or asynchronous clipboard-reading path. It builds on the event-based workaround discussed in [Glide Data Grid #916](https://github.com/glideapps/glide-data-grid/issues/916#issuecomment-4192398589), adding quoted TSV parsing, input limits, rectangular validation, and protection for ordinary text editors.

This is an application workaround. The Windows desktop Excel round trip from that report has not been reproduced here, and this does not establish its root cause. Use it when you have verified that the event's `text/plain` contains the values your application wants. Plain text is not guaranteed to contain a spreadsheet's underlying numeric precision, formulas, or rich cell metadata.

## Add the adapter

Copy `paste-event.mjs`, `paste-event.d.mts`, and `LICENSE` into your project. Keep the declaration beside the module. The adapter uses the [Markdown Table module's TSV parser](../../javascript/markdown-table), without formatting any Markdown. Either keep the repository directory layout or install the versioned module:

```sh
npm install https://raw.githubusercontent.com/tevinch/data-shape-kit/markdown-table-v0.1.0/downloads/tevinch-markdown-table-0.1.0.tgz
```

For that installation, change the adapter's import to:

```js
import { parseDelimited, TableTextError } from '@tevinch/markdown-table';
```

The versioned package comes from GitHub, not the npm registry. The adapter itself is provided as source here.

## Connect it to an existing grid

Keep your existing controlled `gridSelection`, `setGridSelection`, and application-owned `applyPaste(target, values)` callback. Here, `applyPaste` must validate and apply the entire batch to your data source; it is not a Glide method. Inside that component:

```tsx
import type { ClipboardEventHandler } from 'react';
import { readPlainTextPaste } from './paste-event.mjs';

const onPlainTextPaste: ClipboardEventHandler<HTMLDivElement> = event => {
  try {
    const range = gridSelection.current?.range;
    const batch = readPlainTextPaste(event, range ? [range.x, range.y] : undefined);
    if (!batch) return;
    applyPaste(batch.target, batch.values);
    setPasteError('');
  } catch {
    setPasteError('Paste was not applied. Check the text, column counts, size, and destination cells.');
  }
};
```

Add the wrapper and props to your existing grid, keeping its other required props:

```tsx
<div onPasteCapture={onPlainTextPaste}>
  <DataEditor
    {...existingGridProps}
    gridSelection={gridSelection}
    onGridSelectionChange={setGridSelection}
    keybindings={{ ...existingGridProps.keybindings, paste: false }}
    onPaste={false}
  />
  {pasteError && <p role="alert">{pasteError}</p>}
</div>
```

`pasteError` is ordinary component state, for example `const [pasteError, setPasteError] = useState('')`. Choose the top-left of the current selected range as above. The adapter does not invent a destination for a row-only or column-only selection.

Both settings matter. In the [inspected source](https://github.com/glideapps/glide-data-grid/blob/0875d78cc41535a39f8b417ff88ce1ebe129c363/packages/core/src/data-editor/data-editor.tsx#L3583), Glide checks `keybindings.paste` before reading the clipboard, but checks `onPaste` afterwards. Its [paste listener](https://github.com/glideapps/glide-data-grid/blob/0875d78cc41535a39f8b417ff88ce1ebe129c363/packages/core/src/data-editor/data-editor.tsx#L3767) uses window capture, which runs before the wrapper's capture handler. Disabling that path prevents it from starting a second clipboard read. See the official [editing API](https://docs.grid.glideapps.com/api/dataeditor/editing#onpaste) and [keybindings](https://docs.grid.glideapps.com/api/dataeditor/input-interaction#keybindings).

Your batch callback owns destination bounds, read-only cells, data types, validation, undo, and persistence. Validate the complete batch before writing anything. If it performs asynchronous work, catch its rejection and report the outcome in that callback; the synchronous handler above does not await it. Grid-provided conversion and validation callbacks are not automatically invoked by this application-owned path.

## Behavior and limits

- Reads only `event.clipboardData.getData('text/plain')`; never reads HTML, calls `navigator.clipboard`, uploads data, or stores it.
- Preserves quoted tabs, quoted CRLF/LF/CR line breaks, doubled quotes, leading zeros, whitespace, and empty cells as strings. It does not evaluate formulas or infer numbers.
- One initial unquoted BOM and one final record separator are structural. Additional blank rows remain data. Empty text is a consumed no-op.
- Rejects malformed quotes, ragged rows, input over 100,000 UTF-16 code units, more than 1,000 rows, or more than 64 columns. It never pads or truncates a batch.
- Prevents default and stops propagation before parsing, including on rejected input. Already-handled or noncancelable events and missing selections are left untouched. Native inputs, textareas, selects, contenteditable regions, and textbox descendants keep their normal paste behavior.
- Returns `{ target, values }` for the caller to apply once, or `undefined` when no batch should be applied. Parse failures throw structural errors that do not contain input values.

This handles native paste events inside the wrapper. It does not implement the grid's custom context-menu paste or `gridRef.emit('paste')`; those have no native event, and are disabled with the built-in paste path. Formatting, links, merged cells, custom cell metadata, and rich clipboard formats are outside its scope. Clipboard contents that were already rounded or changed by the source application cannot be recovered by this adapter.

## Check it

From this directory in a repository checkout, with Node.js 20 or newer:

```sh
node --test test.mjs
```

The tests cover event consumption, plain-text-only reads, quoted cells, editable targets, malformed input, bounds, and target coordinates. The adapter can be exercised independently of Glide. The full Glide application and Windows Excel workflow have not been run here; confirm them in your own integration before adopting the workaround.

## Optional coffee

This solution is free under the MIT license. If it saves you some time and you feel like buying me a coffee, thank you — it is entirely optional.

- **USDC on Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC on Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please match the asset and network exactly. Transfer and withdrawal fees depend on your wallet or exchange.
