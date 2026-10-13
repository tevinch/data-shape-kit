# Export optional fields to CSV

JSON API results and database records can have fields that appear only in later rows. Papa Parse's documented default takes object keys from the first row, so those later fields need an explicit export schema. [Issue #1174](https://github.com/mholt/PapaParse/issues/1174) shows `c: 5` being omitted from a two-record export.

For flat records, collect the own enumerable keys from every row in first-seen order, then use the documented [`fields` and `data` input](https://www.papaparse.com/docs#unparse):

```js
const rows = [{ a: 1, b: 2 }, { a: 3, b: 4, c: 5 }];
const fields = [...new Set(rows.flatMap(Object.keys))];
const data = rows.map(row => fields.map(field => Object.hasOwn(row, field) ? row[field] : undefined));
const csv = fields.length ? Papa.unparse({ fields, data }) : '';
```

The complete output is:

```csv
a,b,c
1,2,
3,4,5
```

This uses the existing public API. It does not change Papa Parse's default or add a new parser option. If your application already selects columns deliberately, keep that selection. The small [copy-in recipe](recipe.mjs) respects an explicit `options.columns` value and forwards the remaining export settings:

```js
import { exportCsv } from './recipe.mjs';

const csv = exportCsv(rows, { delimiter: ';', newline: '\n' });
// An explicit schema still limits and orders the fields:
const selected = exportCsv(rows, { columns: ['b', 'a'] });
```

For `{ data: rows }` input, pass its `data` array to the recipe. Mapping records to fixed-width arrays keeps completely empty records aligned with the same header. Empty input or records with no own enumerable fields produce an empty string. An explicitly supplied empty `columns` array retains Papa Parse's normal error.

## Run and check

Use Node.js 22 or later. From this directory:

```sh
npm ci --ignore-scripts
npm run example
npm test
```

The dependencies are pinned to Papa Parse 5.7.0. Nine programmatic tests cover the reported export and CSV readback, an empty first record, later fields, quoted multiline text, literal identifiers, empty input, export settings, explicit column restrictions and unchanged input. Missing own fields such as `constructor` remain empty. The checks also retain `header: false`, both `skipEmptyLines` modes and `escapeFormulae` settings.

The original first-record export is available as a failing comparison:

```sh
CSV_SCHEMA_BASELINE=1 node --test test.mjs
```

CSV is a table of text. Absent fields, `null`, `undefined` and empty strings become empty cells; their original distinctions and JavaScript types are not recovered by this recipe. It does not flatten nested objects. All records must be available before deriving the header. For large streaming exports or a fixed database schema, supply known columns instead of scanning an entire dataset.

Verified on 2026-10-14 with Node.js 24.19.0 and Papa Parse 5.7.0. These are Node checks; use in the reporter's application has not been confirmed. The example is free under this repository's MIT license.

## Optional coffee

This recipe and its checks are free. If they save you time and you'd like to buy me a coffee, thank you. It is entirely optional.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
