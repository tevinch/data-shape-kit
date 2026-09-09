# Markdown Table

Generate a GitHub Flavored Markdown table from CSV or spreadsheet clipboard text. Includes a [React component and DevKit integration guide](../../examples/react-markdown-table). The conversion module has no runtime dependencies, uploads, storage or network calls.

## Use the module

Copy `index.mjs`, `index.d.mts` and `LICENSE` into your project. Keep the declaration beside the module for TypeScript.

```js
import { buildMarkdownTable } from './index.mjs';

const result = buildMarkdownTable('ID,Note\n001,"a|b"', {
  delimiter: ',',
  firstRowHeaders: true,
  alignments: ['left', 'none'],
});
console.log(result.markdown);
```

Output:

```text
| ID | Note |
| :--- | --- |
| 001 | a\|b |
```

Choose `delimiter: '\t'` for spreadsheet clipboard text. Delimiters are explicit; the module does not guess whether a comma is data or a separator.

## Behavior

- Quoted cells support delimiters, doubled quotes, and CRLF/LF/CR line endings. A double quote must enclose the whole cell; malformed quotes fail with a one-based row and column.
- Cells remain strings. Parsing does not trim whitespace, turn `001` into a number, evaluate formulas, or interpret dates.
- One initial unquoted BOM and one final record separator are structural. Extra blank rows remain data. Empty input produces empty output.
- Rows must have the same number of cells. There is no silent padding or truncation.
- The first row supplies headers by default. Set `firstRowHeaders: false` to generate `Column 1`, `Column 2`, etc., retaining every input row as data. Blank and duplicate headers are allowed.
- `alignments` is positional and accepts `none`, `left`, `center`, or `right`. Omitted columns use `none`; extra or invalid entries are rejected.
- The limit is 100,000 UTF-16 code units of input, 1,000 rows including any header, and 64 columns. Direct matrix formatting enforces the same row/column bounds and a 100,000-unit total cell-text bound. Oversized input fails instead of being truncated.

`parseDelimited(text, delimiter)` returns a string matrix. `formatMarkdown(matrix, options?)` returns `{ headers, rows, markdown }` without mutating the input. `buildMarkdownTable(text, options)` combines both steps. `TableTextError` provides `code`, `row`, and `column`; its message does not include input values. Invalid API argument types throw `TypeError`.

## Literal text and rendering

This is a text-table generator. Markdown punctuation is escaped, HTML and entity starts are encoded, and URLs remain literal text rather than generated links. Newlines inside cells become `<br>`. Unicode line and paragraph separators are encoded as numeric references to keep them inside their cells.

Use a GFM renderer that permits `<br>` for multiline cells. Markdown renderers can trim surrounding whitespace and collapse repeated spaces or tabs. The original strings remain available in `headers` and `rows`; Markdown output is a presentation format, not a lossless replacement for CSV/TSV. Existing Markdown formatting, HTML, merged cells and formulas are not interpreted. Nonprinting control characters may be handled differently by downstream viewers.

See the official [GFM table syntax](https://github.github.com/gfm/#tables-extension-) and [backslash escape rules](https://github.github.com/gfm/#backslash-escapes). A host application remains responsible for how it renders documents; this module is not a general HTML sanitizer.

## Check it

From this directory, using Node.js 20 or newer:

```sh
node --test test.mjs
```

The 16 core tests cover quoted CSV and TSV, string preservation, structural errors, limits, headers, alignment, escaping and Unicode separators. An optional check renders 110 literal-cell cases with Marked, including subsequent rows to detect broken table structure:

```sh
table_check_dir=$(mktemp -d)
npm install --prefix "$table_check_dir" --ignore-scripts --no-audit --no-fund marked@18.0.10
node render.test.mjs "$table_check_dir/node_modules/marked/lib/marked.esm.js"
```

Marked is a test dependency only. It is not imported by the module or React example.

## Optional coffee

This component is free under the MIT license. If it saves you some time and you feel like buying me a coffee, thank you — it is entirely optional.

- **USDC on Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC on Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please match the asset and network exactly. Transfer and withdrawal fees depend on your wallet or exchange.
