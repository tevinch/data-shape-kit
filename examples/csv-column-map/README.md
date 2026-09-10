# CSV Column Map

Free, copyable JavaScript for selecting and renaming CSV columns while keeping each value attached to its original column. Use the small core with already-parsed arrays, or the included PapaParse adapter with CSV text.

## Download and try

[Download the source ZIP](https://github.com/tevinch/data-shape-kit/raw/refs/heads/main/downloads/csv-column-map-v0.1.0.zip), extract it, and run inside `csv-column-map` with Node.js 20 or newer:

```sh
npm ci --ignore-scripts
npm test
npm run example
```

The example pins PapaParse 5.7.0. It is distributed as source through GitHub. To add it to your application, copy [column-map.mjs](column-map.mjs), [papaparse-columns.mjs](papaparse-columns.mjs) and [LICENSE](LICENSE), then install the adapter's dependency:

```sh
npm install papaparse@5.7.0
```

## Keep the columns you name

```js
import { selectCsvColumns } from './papaparse-columns.mjs';

const csv = [
  'Code Set,Internal Note,Code Name,Code Value',
  '001,ignore,"Alpha, beta",NA',
  '002,ignore,Gamma,',
].join('\r\n');

const rows = selectCsvColumns(csv, {
  'Code Set': 'codeSet',
  'Code Name': 'codeName',
  'Code Value': 'codeValue',
});

console.log(rows);
// [
//   { codeSet: '001', codeName: 'Alpha, beta', codeValue: 'NA' },
//   { codeSet: '002', codeName: 'Gamma', codeValue: '' },
// ]
```

Only keys present in the mapping are selected. Omitting `Internal Note` removes that column without moving other values. To use a semicolon or tab delimiter, pass a third argument such as `{ delimiter: ';' }` or `{ delimiter: '\t' }`.

The adapter parses with `header: false` and `dynamicTyping: false`, then builds objects from original column positions. Leading zeros, `NA`, empty strings and long digit strings remain text. It does not infer missing values or numeric types.

## Already have array rows?

Copy just [column-map.mjs](column-map.mjs) and the license. The core has no dependencies:

```js
import { createColumnProjector } from './column-map.mjs';

const project = createColumnProjector(
  ['Name', 'Unused', 'ID'],
  { ID: 'id', Name: 'name' },
);

console.log(project(['Ada', 'skip', '0007']));
// { id: '0007', name: 'Ada' }
```

Create the projector once for a header layout and reuse it for each row. It captures the layout and mapping when created, so later changes to those inputs do not change its behavior. Each call returns a fresh plain object and leaves inputs untouched. Core cell values are preserved as supplied, including numbers, `false`, `null` and object references; this is a shallow projection.

## Validation and matching

Headers match exactly, including case and whitespace. A blank header can be selected with an empty-string source key. The mapping must be a plain object with at least one enumerable own string-keyed entry; a null prototype is also accepted. Inherited, nonenumerable and symbol properties are ignored.

| Condition | Result |
| --- | --- |
| Requested source column is missing | Error naming the missing column |
| Requested source name appears more than once | Error for ambiguous selection |
| Duplicate names occur only in unselected columns | Allowed |
| Two selected columns have the same destination name | Error, before any values can overwrite each other |
| Destination name is empty or not a string | Type error |
| Row is sparse or has a different width from the original header | Error; values are not shifted or filled in |
| Header-only CSV | Empty result array |
| Empty CSV or a reported CSV parse error | Error; no partial result is returned |

Headers and rows must be dense arrays; headers must be a nonempty array of strings. A row keeps its **original full width**, including excluded columns. Properties are created as ordinary own data properties, including names such as `__proto__`. Mapping entries follow JavaScript's `Object.entries` order; integer-like property names follow JavaScript's normal enumeration rules.

CSV row-shape errors identify the parsed data row, starting at 1 after the header. That is not a physical line number when fields span lines or empty records are skipped.

## Scope

`selectCsvColumns(csv, mapping, options)` accepts synchronous CSV **strings**. The only supported option is `delimiter`, defaulting to comma; unrecognized option keys are ignored. A delimiter must be a nonempty string without a quote, CR, LF or BOM. There is no delimiter guessing or forwarding of arbitrary PapaParse options.

The adapter uses `skipEmptyLines: true`: completely empty records are skipped, while whitespace and delimiter-only records are retained and checked for width. PapaParse handles quotes, doubled quotes, embedded newlines and an initial text BOM. Any errors it reports are rejected; this does not make the adapter a validator for every CSV dialect.

The adapter holds parsed input and output in memory. It does not add file loading, streaming or Worker support. Both modules perform no uploads, storage writes or network calls during conversion. They cannot recover characters or precision already lost before receiving the input.

## Why this exists

[PapaParse #1098](https://github.com/mholt/PapaParse/issues/1098) asks how to rename selected headers and exclude the remaining columns. [#1029](https://github.com/mholt/PapaParse/issues/1029) contains related reports about repeated header transformations. These are concrete examples of demand, not a prevalence estimate.

In the supplied synthetic case tested with **5.7.0**, `transformHeader` runs once per column. Returning `null` still creates an unwanted `"null"` property. The [documented option](https://www.papaparse.com/docs) transforms names; it does not define a column-filtering return value. This component makes selection a separate step and preserves the original column positions. It does not patch PapaParse.

The included tests and example use the real pinned parser and synthetic data. Verification covers Node.js 24.19.0; no browser or TypeScript check is claimed. Original code is [MIT licensed](LICENSE). PapaParse is separately MIT licensed.

## Buy me a coffee, if this helped

If this saved you some time, you're welcome to buy me a coffee. Please don't feel obliged — the code stays free, and useful feedback is welcome too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please match the asset and network exactly. Fees depend on your wallet or exchange. Thank you! — Tevinch
