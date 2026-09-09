# Streaming CSV

A free, copyable Node.js solution for processing a UTF-8 CSV file one record at a time, including an asynchronous operation for each record. It combines the established [csv-parse](https://csv.js.org/parse/) parser with a Node stream pipeline, strict UTF-8 decoding and explicit header validation. Original example code is MIT licensed.

Use it when you need to preserve Chinese text, emoji, quoted line breaks and leading zeros while waiting for each record's processing to finish. The included demo reads an invented local file and prints a count plus two sample records. It makes no network requests or file writes.

## Download and run

[Download the source ZIP](https://github.com/tevinch/data-shape-kit/raw/refs/heads/main/downloads/streaming-csv-v0.1.0.zip), extract it, and run these commands inside the extracted directory with Node.js 20 or newer:

```sh
npm ci --ignore-scripts
npm test
npm run demo
```

To try your own local UTF-8 file:

```sh
node demo.mjs ./records.csv
```

The example pins `csv-parse` 7.0.2 as its only runtime dependency. This is a Node solution; the download does not include a browser app. Keep [LICENSE](LICENSE) when copying the original code. Dependency licenses remain with their installed packages.

## Await each record

Copy [consume-csv.mjs](consume-csv.mjs) and its license, install the pinned dependency, then supply a byte stream and a callback:

```sh
npm install --save-exact csv-parse@7.0.2
```

```js
import { createReadStream } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import { consumeCsv } from './consume-csv.mjs';

const result = await consumeCsv(
  createReadStream('./records.csv', { highWaterMark: 64 * 1024 }),
  async (record, { rowNumber, signal }) => {
    // Stand-in for an asynchronous operation that honors cancellation.
    await setImmediate(undefined, { signal });
    console.log(rowNumber, record.id);
  },
);

console.log(result.rows, result.headers);
```

Leave the source in byte mode: do not set its `encoding` or call `setEncoding`. The helper's streaming decoder carries incomplete UTF-8 sequences into the next chunk and rejects malformed or unfinished sequences. A UTF-8 BOM is accepted. The parser handles record boundaries and quoted fields after decoding.

The callback receives string values and a one-based data-row number. The first nonempty record supplies the headers; it is not delivered to the callback. Success resolves only after all callbacks finish:

```js
{ rows: 2, headers: ['id', 'note'] }
```

The callback can be synchronous or return a promise. Start and await the work inside it. Detached work, such as starting a promise without returning or awaiting it, is outside the helper's control.

## Input contract

| Input | Behavior |
| --- | --- |
| UTF-8, optional UTF-8 BOM | Accepted; malformed or incomplete UTF-8 rejects |
| LF, CRLF or CR record endings | Detected by the parser, including chunk boundaries |
| Quoted commas, doubled quotes, multiline cells | Preserved as field content |
| `001`, `NA`, `false`, decimal-looking text | Remain strings |
| Empty physical lines | Skipped |
| A record such as `,,` under three headers | Retained as three empty strings |
| Duplicate headers or whitespace-only header names | Rejected before any data-row callback |
| Empty, blank-only or BOM-only input | Rejected because there is no header |
| Header only | Valid, with zero data rows |
| Unequal field counts or malformed quoting | Rejects with the parser's error |

Use one consistent record-ending style per file. Mixed line-ending files need a separate normalization policy.

Header comparison is case-sensitive. Nonempty names retain their original whitespace. Records preserve own fields named `__proto__` or `constructor` without using those names to change their prototype. The returned header array is separate from internal processing state.

This helper deliberately chooses a strict header policy. With [`columns: true`, csv-parse normally retains only the last value for duplicate names](https://csv.js.org/parse/options/columns/). Here, parsing arrays first and validating the header prevents that silent overwrite. Files needing repeated header names require an explicit mapping policy before adoption.

## Options and cancellation

```js
const controller = new AbortController();

const pending = consumeCsv(source, onRow, {
  delimiter: ';',
  maxRecordSize: 1_048_576,
  signal: controller.signal,
});

// A user cancel action can call controller.abort().
await pending;
```

`delimiter` defaults to a comma. It must be a nonempty string without a quote, CR or LF. `maxRecordSize` defaults to 1,048,576 and must be a positive safe integer; it configures the parser's [`max_record_size`](https://csv.js.org/parse/options/max_record_size/) limit. `signal` is optional and must be an AbortSignal.

A processing run owns its source stream. [Node's pipeline](https://nodejs.org/api/stream.html#streampipelinesource-transforms-destination-options) connects completion, stream errors and cancellation across the stages. Use a fresh source for another run. Invalid arguments are rejected before consuming it.

The callback receives the pipeline signal, so it can stop its own asynchronous work. Cancellation cannot forcibly interrupt a callback that ignores that signal; the operation waits for that callback to settle. A callback error rejects the operation and stops further processing.

Processing is incremental. An error discovered later can occur after earlier callbacks have run. The helper supplies neither retries nor rollback; it is not a transaction or a database import service. The included demo only reads and reports synthetic data.

## What backpressure does here

The consumer awaits one callback before starting the next. When the consumer waits and stream buffers fill, backpressure stops further reads. This avoids creating a pending promise for every row.

There can still be records buffered from the current input chunk. Use bounded source chunks, as the demo does, and retain only what your callback needs. The record-size limit is not a whole-process memory cap. Very wide records, larger source chunks, downstream buffering or keeping every record can increase memory use. No constant-memory or production-throughput guarantee is implied.

For applications that already have their own header, decoding and error policy, the library's [direct async-iterator example](https://csv.js.org/parse/api/async_iterator/) is a useful simpler starting point.

## Why this example exists

Several community reports describe related streaming difficulties: [a July 2026 report with UTF-8 boundaries and pause behavior](https://github.com/mholt/PapaParse/issues/1132), [empty fields changing after resume](https://github.com/mholt/PapaParse/issues/985), and [header/data confusion during streamed consumption](https://github.com/mholt/PapaParse/issues/998). These are separate reports of demand, not a prevalence survey.

An independent 80-record Node reproduction compared complete expected records containing Chinese text, emoji, quoted CRLF and trailing empty cells. With one-byte source chunks, PapaParse 5.7.0's callback stream path returned 80 records but corrupted the non-ASCII text; a csv-parse 7.0.2 pipeline preserved every record. The same fixture also passed with PapaParse 5.7.0 after Node decoded the source as UTF-8, through both its callback and duplex interfaces. If that is your only problem, the smaller adjustment is:

```js
const input = createReadStream(filePath, { encoding: 'utf8' });
// Supply this text stream to your existing PapaParse Node integration.
```

That adjustment belongs to the existing PapaParse integration; the `consumeCsv` helper above requires a byte stream because it owns strict decoding. Node's ordinary UTF-8 decoding can replace malformed sequences; this helper rejects them. The comparison establishes the tested UTF-8 boundary behavior, not the status of every upstream report.

This package is an independent solution using csv-parse. It does not patch PapaParse or reproduce all its options. The original contributor's [UTF-8](https://github.com/mholt/PapaParse/pull/1133), [line-ending](https://github.com/mholt/PapaParse/pull/1134), [header](https://github.com/mholt/PapaParse/pull/1135) and [backpressure](https://github.com/mholt/PapaParse/pull/1136) pull requests are the relevant upstream work. On September 10, 2026, the header fix was merged; the other three were open. If an upstream release meets your needs, use its tested interface.

## Verification

The source download includes behavior tests using actual Node streams and temporary files. They exercise Unicode and CSV boundaries, sequential callback completion, a blocked consumer, stream/callback failures, malformed input, header validation and cancellation. The file demo is also run as a child process for success and failure cases. On Node.js 24.19.0, all 47 tests passed in both the source checkout and a fresh extraction of the download. The bundled demo produced the same three-row result and two sample records in both locations.

## Buy me a coffee, if this helped

If this saved you some time, you're welcome to buy me a coffee. Please don't feel obliged — the code stays free, and useful feedback is welcome too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please match the asset and network exactly. Fees depend on your wallet or exchange. Thank you! — Tevinch
