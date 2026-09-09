# Pasting spreadsheet data without breaking multiline cells

Splitting clipboard text on every newline turns a two-line cell into two records. Trimming the input first can also remove the tabs that represent empty columns at the edge of a selected range.

I made [Clipboard Table](../javascript/clipboard-table), a free JavaScript module for this small part of a form or data grid. It reads plain-text TSV, preserves string values and provides an optional header-to-object step. It is available as copyable MIT-licensed source, with no runtime dependencies.

## What the community examples show

I reviewed seven deliberately selected threads on 9 September 2026, grouping each under one main issue. This is a small convenience sample, not a measurement of overall demand, popularity or currently unresolved bugs. The four linked GitHub issues are closed; the examples describe failure cases worth avoiding in a new integration. Several concern HTML paste paths, which this module does not implement. They informed the choice to process `text/plain` explicitly.

| Main issue | Threads | Example sources |
| --- | ---: | --- |
| Multiline cells and row boundaries | 3 | [Excel to a web table](https://stackoverflow.com/questions/67773475/copy-paste-from-excel-difference-between-line-break-in-cell-and-row-delimiter), [Google Sheets multiline paste](https://github.com/handsontable/handsontable/issues/8117), [Missing line breaks](https://github.com/handsontable/handsontable/issues/5970) |
| Quoting and escaped quotes | 2 | [Consecutive quotes](https://github.com/handsontable/handsontable/issues/4003), [Quotes appearing when copying a cell](https://stackoverflow.com/questions/24910288/leave-out-quotes-when-copying-from-cell) |
| Empty-cell handling | 1 | [Pasted cells becoming “null”](https://github.com/telerik/kendo-ui-core/issues/1882) |
| Identifier conversion | 1 | [Leading zeros during CSV-to-JSON conversion](https://discuss.python.org/t/leading-zeros-issue-while-converting-csv-to-json/47186) |

The last thread is a related CSV conversion example, not a clipboard bug. It supports keeping identifiers as strings; a parser cannot recover digits or zeros removed before the text reaches it.

## Keep a newline inside its field

Here is a synthetic clipboard payload with two records. The Notes value in the second record contains its own newline:

```js
const text = 'SKU\tNotes\r\n00123\t"First line\nSecond line"\r\n';
```

A parser must track whether it is inside a quoted field. Outside quotes, a tab ends the field and a newline ends the record. Inside quotes, both characters belong to the value. Two consecutive quotes inside a quoted field represent one literal quote.

```js
import { parseClipboard, toRecords } from './index.mjs';

const records = toRecords(parseClipboard(text));
// [{ SKU: '00123', Notes: 'First line\nSecond line' }]
```

The parser distinguishes an empty clipboard from an explicitly empty cell. It removes one structural trailing record separator while preserving explicit blank rows and empty columns. It does not trim spaces, remove blank rows, or guess a column's data type.

## Read the format you intend to process

The browser's paste event provides a `DataTransfer` object. Read `text/plain` from the event for this TSV parser. The [browser API reference](https://developer.mozilla.org/en-US/docs/Web/API/ClipboardEvent/clipboardData) describes that access; the [paste-event reference](https://developer.mozilla.org/en-US/docs/Web/API/Element/paste_event) explains replacing default paste behavior. The module README includes complete vanilla JavaScript and React integration examples.

HTML clipboard content can contain its own structure, line-break elements and styles. This module does not try to interpret it. Merged cells, spreadsheet formulas, number formats and application-specific paste behavior need a different layer.

## Refuse ambiguous object mappings

Two columns both named `SKU` cannot both fit into an object with one `SKU` property. `toRecords` reports duplicate or blank headers and mismatched row widths instead of silently discarding a value. It retains exact header spelling and treats every cell as a string.

The parser also accepts explicit character, row and column limits. A missing closing quote or text after a closing quote yields a structural error with a table position and no source value in the message.

## Copy it into a project

The [source, declarations, runnable example and tests](../javascript/clipboard-table) are in one directory. Copy `index.mjs` with `LICENSE` and, for TypeScript, its neighboring `index.d.mts`. No Python installation is needed for this module.

The regression suite has 31 tests, including 144 deterministic round trips over empty strings, quotes, tabs, line breaks, whitespace, Unicode and leading-zero values. These tests exercise the text grammar; they are not a live compatibility matrix for spreadsheet applications. When adopting the module, check a real copy/paste from the spreadsheet versions your users have.

`formatClipboard` can serialize the strings back to TSV, but it preserves formula-looking text. A receiving spreadsheet can evaluate formulas or convert values. It is not a formula-neutralizing exporter.

If you already use a CSV/TSV library, check its quoting, blank-row and type-conversion options before adding another parser. Clipboard Table is an option for small integrations where copyable source and explicit behavior are useful.

## Buy me a coffee, if this helped

If this saved you a little time, you're welcome to buy me a coffee. Please don't feel obliged — feedback or sharing the module is appreciated too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please match the asset and network exactly. Fees depend on your wallet or exchange. Thank you! — Tevinch
