# Three free components for data-entry workflows

Choose the small component that matches your problem. Each download includes its source, license and tests. The cores are independently usable; you do not need to install the rest of Data Shape Kit. This collection packages existing releases together as a selection guide, with fixed download versions.

| Your problem | Component | Start with |
| --- | --- | --- |
| Spreadsheet paste loses quoted line breaks, empty cells or leading zeros | Clipboard Table v0.1.1 | A dependency-free JavaScript parser for the quoted TSV text your application receives |
| A delayed field check shows an old result, or submitting immediately misses the latest input | Remote field check v0.1.0 | A dependency-free JavaScript controller; React/RHF example and bundled local demo included |
| One malformed JSONL line stops the file import | JSONL partition v0.1.0 | A standard-library Python helper that preserves accepted and rejected bytes and reports rejected line locations |

The linked guides connect each component to the community questions that prompted it and explain its limits. These are separate tools, with separate setup instructions.

## Spreadsheet paste: Clipboard Table

[Download ZIP](https://raw.githubusercontent.com/tevinch/data-shape-kit/84427be503815905004a31fc79353f91fcf669b6/downloads/clipboard-table-v0.1.1.zip) · [Full guide and community examples](https://github.com/tevinch/data-shape-kit/tree/84427be503815905004a31fc79353f91fcf669b6/javascript/clipboard-table)

Extract the ZIP and open a terminal in `clipboard-table-v0.1.1`. With Node.js 22 or newer:

```sh
node example.mjs
```

Copy `index.mjs` and `LICENSE` into your application; TypeScript projects can also copy `index.d.mts`. The parser keeps values as strings. It handles the quoted TSV dialect described in the guide, including multiline cells. It does not read XLSX or HTML clipboard data, preserve formatting, or recover values already changed by the source application.

For a quick browser trial, the [existing playground](https://tevinch.github.io/data-shape-kit/) accepts pasted text and provides CSV, JSON and Markdown output. Its guide explains the supported formats and limits.

## Remote checks: keep the current field result

[Download ZIP](https://raw.githubusercontent.com/tevinch/data-shape-kit/84427be503815905004a31fc79353f91fcf669b6/downloads/remote-field-check-v0.1.0.zip) · [Full guide and React/RHF integration](https://github.com/tevinch/data-shape-kit/tree/84427be503815905004a31fc79353f91fcf669b6/examples/remote-field-check)

Extract the ZIP and open a terminal in `remote-field-check`. With Node.js 22 or newer, this core example uses a local callback and needs no package installation:

```sh
node --input-type=module <<'JS'
import { createRemoteCheck } from './remote-check.mjs';
const remote = createRemoteCheck(value => value === 'taken' ? 'Already in use.' : null);
const result = await remote.checkNow('available');
if (result.status !== 'valid' || !remote.isCurrent(result)) throw new Error('Unexpected result');
console.log(result.status);
remote.cancel();
JS
```

It prints `valid`. The controller supports debounce, cancellation, timeouts and checking that a completed result is still current. Your application supplies the service adapter. The React/RHF example needs its documented dependencies; keep the included third-party notices with the bundled browser demo. An availability check is feedback at that moment, so the actual server operation must validate again.

## JSONL: retain the rejected records

[Download ZIP](https://raw.githubusercontent.com/tevinch/data-shape-kit/84427be503815905004a31fc79353f91fcf669b6/downloads/jsonl-partition-v0.1.0.zip) · [Full guide, CLI and Polars example](https://github.com/tevinch/data-shape-kit/tree/84427be503815905004a31fc79353f91fcf669b6/examples/jsonl-partition)

Extract the ZIP and open a terminal in `jsonl-partition`. With Python 3.11 or newer, this standard-library example needs no package installation:

```sh
python - <<'PY'
from io import BytesIO, StringIO
from jsonl_partition import partition_jsonl
source = BytesIO(b'{"a": 1,"b": 3}\nx\n{"a": 4,"b": 2}\n')
accepted, rejected, issues = BytesIO(), BytesIO(), StringIO()
stats = partition_jsonl(source, accepted, rejected, issues)
assert (stats.lines, stats.accepted, stats.rejected) == (3, 2, 1)
assert rejected.getvalue() == b'x\n'
print(stats.accepted, stats.rejected)
print(issues.getvalue(), end='')
PY
```

It prints two accepted records, one rejected record and metadata locating the rejected line. The CLI writes separate accepted, rejected, issue and summary files into a new directory. The input format is one UTF-8 JSON object per physical line. Validation does not establish a compatible table schema; downstream dtype and numeric limits still apply. Polars is optional and has its own installation step in the full guide.

## Versions and verification

These downloads are pinned to a specific repository commit. The [SHA-256 file](../downloads/component-collection-2026-09.sha256) lists their exact bytes; compare it with your downloaded files if needed.

The three commands above were executed from fresh copies of the fixed archives using Node.js 24.19.0 and Python 3.12.14. Component test coverage and dependency versions are documented in the individual guides. Python 3.11 compatibility for JSONL partition is based on syntax and standard-library API review; execution verification used Python 3.12.14. Browser behavior and service integrations should be checked in the environment where you use them.

For help with a component, [open a GitHub issue](https://github.com/tevinch/data-shape-kit/issues/new?template=component-feedback.md) with its name, version, a small invented input and expected output. Keep real datasets and credentials out of public examples.

## License

The component source is MIT licensed. Retain each included license, and the third-party notices supplied with the remote-check browser bundle.

## Buy me a coffee, if this helped

These tools are free. If one saves you a little time and you feel like buying me a coffee, a small contribution is welcome. There is no obligation; feedback and useful examples are appreciated too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please use the asset and network shown above.
