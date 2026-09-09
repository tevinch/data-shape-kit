# Clipboard Table

Copyable JavaScript functions for spreadsheet paste fields. Keep multiline cells, double quotes, empty columns, whitespace and leading zeros intact in the plain-text data you receive. Free under the [MIT license](LICENSE), with no runtime dependencies and no build step.

## Try it

To try it without installing anything, download the [local browser playground](../../downloads/clipboard-table-playground-v0.1.0.zip?raw=true), extract it and open `index.html` in a modern browser. Paste quoted TSV or choose **Load example**, switch between header-based JSON objects and arrays, then use **Download JSON** to save the complete result. The preview shows up to 30 data rows and 8 columns; parsing retains the limits below. Everything runs in the page with no uploads or external runtime assets.

For the module, examples and tests in one download, get the [standalone v0.1.0 archive](../../downloads/clipboard-table-v0.1.0.zip?raw=true). After extracting it, run `node example.mjs` or `node --test test.mjs` from its directory.

Copy [`index.mjs`](index.mjs) and [`LICENSE`](LICENSE) into your project. TypeScript projects can also copy [`index.d.mts`](index.d.mts) beside it. This module runs independently of the Python tools in this repository. It is distributed as source here, not as an npm package.

```js
import { parseClipboard, toRecords } from './index.mjs';

const text = 'SKU\tNotes\r\n00123\t"First line\nSecond line"\r\n';
const rows = parseClipboard(text);
console.log(toRecords(rows));
// [{ SKU: '00123', Notes: 'First line\nSecond line' }]
```

From a repository checkout, run the synthetic example and tests with Node.js 22 or newer:

```sh
node javascript/clipboard-table/example.mjs
node --test javascript/clipboard-table/test.mjs
```

The module uses standard modern JavaScript features including `Object.hasOwn` and `String.replaceAll`.

The playground source lives in [`playground.html`](playground.html) and [`playground.mjs`](playground.mjs). To rebuild the self-contained HTML from the canonical parser, run `node javascript/clipboard-table/build-playground.mjs` from the repository root. The result is [`downloads/clipboard-table-playground.html`](../../downloads/clipboard-table-playground.html). Pasting retains line endings in the received text; editing the text box uses the browser's normalized line endings.

## Connect a paste field

For a page containing `<textarea id="paste-input"></textarea>` and `<pre id="result"></pre>`, serve the copied module alongside your page and use this module script:

```js
import { parseClipboard } from './index.mjs';

const input = document.querySelector('#paste-input');
const output = document.querySelector('#result');
input.addEventListener('paste', event => {
  if (!event.clipboardData?.types.includes('text/plain')) return;
  event.preventDefault();
  try {
    const rows = parseClipboard(event.clipboardData.getData('text/plain'));
    output.textContent = JSON.stringify(rows, null, 2);
  } catch (error) {
    output.textContent = error.message;
  }
});
```

Use `textContent` for the preview. The handler reads the current paste event only and processes its plain text locally. The module has no network requests or storage. The surrounding application determines what happens to its returned values.

A React paste handler uses the same functions:

```jsx
import { useState } from 'react';
import { parseClipboard } from './index.mjs';

export function PasteField() {
  const [preview, setPreview] = useState('');
  function onPaste(event) {
    if (!event.clipboardData.types.includes('text/plain')) return;
    event.preventDefault();
    try {
      setPreview(JSON.stringify(parseClipboard(
        event.clipboardData.getData('text/plain')
      ), null, 2));
    } catch (error) {
      setPreview(error.message);
    }
  }
  return <>
    <label>Paste a spreadsheet range <textarea onPaste={onPaste} /></label>
    <pre aria-live="polite">{preview}</pre>
  </>;
}
```

Browser event behavior is documented in MDN's [clipboardData](https://developer.mozilla.org/en-US/docs/Web/API/ClipboardEvent/clipboardData) and [paste event](https://developer.mozilla.org/en-US/docs/Web/API/Element/paste_event) references. These are integration examples; test a real copy/paste on the spreadsheet and browser versions your application supports.

For Sanity's `_key`/`_type`/`cells` row shape, the separate [grid update helper and worked example](sanity-rows.md) preserve existing row keys and surrounding cells while growing a pasted rectangle. This source-only companion does not send Studio patches and is not included in the v0.1.0 parser archive or browser playground.

## API

### `parseClipboard(text, limits?) → string[][]`

- Tab separates cells; LF, CRLF and CR separate records.
- A field starting with `"` is quoted. Within it, `""` represents one quote and tabs/newlines remain in the cell. A quote inside an unquoted field is literal.
- An initial unquoted UTF-8 BOM, represented as `\uFEFF` in JavaScript, is removed. All other characters, including spaces and non-breaking spaces, are preserved.
- Empty input produces `[]`. A single empty quoted cell produces `[['']]`.
- One terminal record separator ends the preceding row. Further separators preserve explicit blank rows. No `.trim()` is applied.
- Values remain strings. `00123`, a long identifier, a date-looking value and `true` are not converted.
- Ragged rows are preserved by the parser. Use `toRecords` when you need a rectangular table with a header.

```js
parseClipboard(text, { maxChars: 500_000, maxRows: 2_000, maxColumns: 80 });
```

Defaults: 1,000,000 UTF-16 code units including a leading BOM, 10,000 rows and 256 columns. Overrides must be positive safe integers; unknown option names are rejected. Bounds apply to parsing, not to the input array of the other functions.

### `formatClipboard(rows) → string`

Serializes arrays of strings with tab-separated cells and CRLF-separated records. Quotes are escaped by doubling. Empty cells and cells containing quotes, tabs, line breaks or BOM characters are quoted. There is no terminal record separator. Within the parser's size limits, `parseClipboard(formatClipboard(rows))` preserves cell contents and row lengths. Empty rows (`[]`) and non-string cells are rejected; an empty table (`[]`) is allowed.

### `toRecords(rows) → Record<string, string>[]`

Uses the first row as exact, case-sensitive headers. It rejects blank/whitespace-only headers, exact duplicate headers and rows of a different width, so values are not silently dropped. Headers are not trimmed or renamed. Special names such as `__proto__` become own data properties. The input arrays are not changed.

### Errors

Wrong argument types, non-string cells and invalid limits throw `TypeError`. Structural errors throw `ClipboardTableError` with `code`, one-based table `row` and `column`, and a zero-based UTF-16 `offset` for parser errors. Embedded line breaks do not increment the table row. Error messages do not include source values.

Codes: `MAX_CHARS`, `MAX_ROWS`, `MAX_COLUMNS`, `UNCLOSED_QUOTE`, `UNEXPECTED_CHARACTER`, `EMPTY_HEADER`, `DUPLICATE_HEADER`, `RAGGED_ROW`.

## What it covers

This parses the quoted TSV dialect described above. It does not read XLSX files, interpret HTML clipboard data, preserve merged cells or styles, evaluate formulas, or recover zeros/precision already lost in the source application. `formatClipboard` preserves formula-looking text: pasting that text into spreadsheet software can evaluate it. Quoting a field does not disable spreadsheet formulas or prevent the receiving application from converting types.

The suite checks 31 cases, including 144 deterministic round trips. This is not a claim of live interoperability testing across every Excel, Sheets and browser version. For large file imports or additional delimiter dialects, an established CSV/TSV parser may suit your application better.

The [design notes and seven community examples](../../docs/spreadsheet-clipboard-pitfalls.md) explain the cases behind the module. Feedback with a small synthetic input and expected output is welcome through [GitHub issues](https://github.com/tevinch/data-shape-kit/issues).

## Buy me a coffee, if this helped

If this saved you a little time, you're welcome to buy me a coffee. Please don't feel obliged — using the code, reporting an issue, or sharing it is appreciated too.

- **USDC on Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC on Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please match the asset and network exactly. Fees depend on your wallet or exchange. Thank you! — Tevinch
