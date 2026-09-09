# Markdown Table

Generate a GitHub Flavored Markdown table from CSV or spreadsheet clipboard text. Try the [free browser converter](https://tevinch.github.io/data-shape-kit/): choose CSV or TSV input and Markdown table output. Includes a [React component and DevKit integration guide](https://github.com/tevinch/data-shape-kit/tree/markdown-table-v0.1.0/examples/react-markdown-table). The conversion module has no runtime dependencies, uploads, storage or network calls.

## Install version 0.1.0

Using Node.js 20 or newer, install the versioned package directly from this GitHub repository:

```sh
npm install https://raw.githubusercontent.com/tevinch/data-shape-kit/markdown-table-v0.1.0/downloads/tevinch-markdown-table-0.1.0.tgz
```

This package is distributed through GitHub, not published to the npm registry. Use the complete URL above; installing by its package name alone will not retrieve this release. The package has no install scripts. React is an optional peer dependency and is not installed for core-only use. Commit your application's lockfile to retain the resolved URL and integrity hash.

## Use the module

```js
import { buildMarkdownTable } from '@tevinch/markdown-table';

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

ES modules and TypeScript declarations are included. For TypeScript, use modern `node16`, `nodenext`, or `bundler` module resolution. CommonJS callers can use dynamic `import()`. Alternatively, copy `index.mjs`, `index.d.mts`, and `LICENSE` into your project, keep the declaration beside the module, and import from `./index.mjs`.

## Optional React component

Use the React entry in a project with React 18 or newer already installed:

```tsx
import MarkdownTableGenerator from '@tevinch/markdown-table/react';

export default function Example() {
  return <MarkdownTableGenerator />;
}
```

The compiled entry includes TypeScript declarations and the `"use client"` directive. It has native controls by default and accepts optional shared controls through its `controls` prop. The component's classes target Tailwind CSS 4. Tailwind ignores `node_modules` by default, so register the installed files in your Tailwind stylesheet. For example, if the stylesheet is `src/styles.css` and `node_modules` is at the project root:

```css
@import "tailwindcss";
@source "../node_modules/@tevinch/markdown-table/react";
```

Adjust the source path relative to your stylesheet. Without Tailwind, the controls work but require your own layout styles. Clipboard copying needs a suitable browser context and permission; **Select output** provides a manual fallback. The [React guide](https://github.com/tevinch/data-shape-kit/tree/markdown-table-v0.1.0/examples/react-markdown-table) covers preview limits, behavior, and the DevKit adapter.

## Behavior

- Quoted cells support delimiters, doubled quotes, and CRLF/LF/CR line endings. A double quote must enclose the whole cell; malformed quotes fail with a one-based row and column.
- Cells remain strings. Parsing does not trim whitespace, turn `001` into a number, evaluate formulas, or interpret dates.
- One initial unquoted BOM and one final record separator are structural. Extra blank rows remain data. Empty input produces empty output.
- Rows must have the same number of cells. There is no silent padding or truncation.
- The first row supplies headers by default. Set `firstRowHeaders: false` to generate `Column 1`, `Column 2`, etc., retaining every input row as data. Blank and duplicate headers are allowed.
- `alignments` is positional and accepts `none`, `left`, `center`, or `right`. Omitted columns use `none`; extra or invalid entries are rejected.
- The limit is 100,000 UTF-16 code units of input, 1,000 rows including any header, and 64 columns. Direct matrix formatting enforces the same row/column bounds and a 100,000-unit total cell-text bound. Oversized input fails instead of being truncated.

`parseDelimited(text, delimiter)` returns a string matrix. `formatMarkdown(matrix, options?)` returns `{ headers, rows, markdown }` without mutating the input. `buildMarkdownTable(text, options)` combines both steps. `TableTextError` provides `code`, `row`, and `column`; its message does not include input values. Invalid API argument types throw `TypeError`.

The current repository source also accepts `parseDelimited(text, delimiter, limits)`, where `limits` may override `maxChars`, `maxRows` and `maxColumns` with positive safe integers. Omitted limits keep the defaults above. This lets the browser converter parse larger JSON inputs; Markdown formatting and `buildMarkdownTable` retain their fixed bounds. This optional third argument is not included in the version 0.1.0 package. Copy the current `index.mjs`, `index.d.mts` and `LICENSE` together to use it.

## Literal text and rendering

This is a text-table generator. Markdown punctuation is escaped, HTML and entity starts are encoded, and URLs remain literal text rather than generated links. Newlines inside cells become `<br>`. Unicode line and paragraph separators are encoded as numeric references to keep them inside their cells.

Use a GFM renderer that permits `<br>` for multiline cells. Markdown renderers can trim surrounding whitespace and collapse repeated spaces or tabs. The original strings remain available in `headers` and `rows`; Markdown output is a presentation format, not a lossless replacement for CSV/TSV. Existing Markdown formatting, HTML, merged cells and formulas are not interpreted. Nonprinting control characters may be handled differently by downstream viewers.

See the official [GFM table syntax](https://github.github.com/gfm/#tables-extension-) and [backslash escape rules](https://github.github.com/gfm/#backslash-escapes). A host application remains responsible for how it renders documents; this module is not a general HTML sanitizer.

## Check it

From `javascript/markdown-table` in a [repository checkout](https://github.com/tevinch/data-shape-kit/tree/markdown-table-v0.1.0), using Node.js 20 or newer (test files are not included in the installed package):

```sh
node --test test.mjs
```

The version 0.1.0 checkout has 16 core tests; the current source has 19, adding parser-limit validation and checking that overrides do not relax Markdown formatting bounds. They cover quoted CSV and TSV, string preservation, structural errors, limits, headers, alignment, escaping and Unicode separators. An optional check renders 110 literal-cell cases with Marked, including subsequent rows to detect broken table structure:

```sh
table_check_dir=$(mktemp -d)
npm install --prefix "$table_check_dir" --ignore-scripts --no-audit --no-fund marked@18.0.10
node render.test.mjs "$table_check_dir/node_modules/marked/lib/marked.esm.js"
```

Marked is a test dependency only. It is not imported by the module or React example.

## Rebuild the package

The React entry is generated from `examples/react-markdown-table/markdown-table-generator.tsx`. From this directory in a repository checkout, install build tools in a temporary directory and compile:

```sh
table_build_dir=$(mktemp -d)
npm install --prefix "$table_build_dir" --ignore-scripts --no-audit --no-fund typescript@5.9.3 @types/react@19.2.18
node build-react.mjs "$table_build_dir/node_modules"
npm pack --ignore-scripts --pack-destination ../../downloads
```

The compiler checks the original TSX, preserves the client directive, and rewrites only its conversion-module import for the package layout. Build tools, tests, source maps, and the DevKit-specific adapter are excluded from the package. The `private` package flag prevents accidental registry publication; it does not restrict installation or the MIT license.

## Optional coffee

This component is free under the MIT license. If it saves you some time and you feel like buying me a coffee, thank you — it is entirely optional.

- **USDC on Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC on Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please match the asset and network exactly. Transfer and withdrawal fees depend on your wallet or exchange.
