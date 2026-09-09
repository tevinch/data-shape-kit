# Identifier Column

Import literal identifiers from CSV or XLSX without turning `00123` into `123.0` or discarding the string `NA`. This independent Python module returns accepted values and a record-by-record report of skipped or rejected input. Free under the [MIT license](LICENSE).

This is a **text identifier contract**. It preserves text already stored in the file. It does not reconstruct identifiers from numbers, spreadsheet display formats or values already rounded by another application.

## Use it

Copy [`identifier_import.py`](identifier_import.py) and [`LICENSE`](LICENSE) into your project. Python 3.11 or newer is required. CSV uses only the standard library; installing pandas does not change the parsing path or its results.

The [standalone v0.1.1 ZIP](https://raw.githubusercontent.com/tevinch/data-shape-kit/main/downloads/identifier-column-v0.1.1.zip) includes the module, guide, synthetic tests and optional QR example. Extract it and run the commands below from its directory.

```python
from identifier_import import read_csv_identifiers

report = read_csv_identifiers('items.csv', 'ID')
print({
    'accepted': len(report.accepted),
    'skipped': len(report.skipped),
    'rejected': len(report.rejected),
})
for notice in report.skipped + report.rejected:
    print(notice.row, notice.reason)
if report.rejected:
    raise ValueError('Review rejected records before continuing')

# After reviewing the report, send these strings to your text consumer.
identifiers = report.values
# ('00123', '00007', 'NA') for the three-record example below.
```

```csv
ID
00123
00007
NA
```

Choose a delimiter explicitly: `delimiter=','` (default), `delimiter=';'` or `delimiter='\t'`. Input must be UTF-8, with an optional leading BOM. Quoted cells may contain delimiters, doubled quotes and line breaks. The parser uses Python's [CSV reader](https://docs.python.org/3/library/csv.html#csv.reader) with strict parsing and no type conversion or delimiter detection.

For XLSX, install `openpyxl==3.1.5` and select a sheet explicitly:

```python
from identifier_import import read_xlsx_identifiers

report = read_xlsx_identifiers('items.xlsx', 'ID', sheet_name='Items')
# Inspect skipped/rejected records before using report.values, as above.
```

## Contract

| Input | Result |
| --- | --- |
| `00123`, `00007`, `NA`, `NULL`, a long digit string | Accepted unchanged |
| Unicode, duplicate identifiers, outer spaces such as ` 001 ` | Accepted unchanged and in order |
| Empty string, empty cell, explicit blank record | Counted as skipped: `empty` |
| Whitespace-only string | Counted as skipped: `blank` |
| CSV record with fewer or more fields than the header | Rejected: `missing_fields` or `extra_fields` |
| Excel numeric cell, including a number displayed with format `00000` | Rejected: `numeric` |
| Excel boolean or date/time cell | Rejected: `boolean` or `date` |
| Excel formula or error cell | Rejected: `formula` or `error` |

All headers must be nonblank, unique strings. Matching is exact and case-sensitive; headers and accepted identifiers are not trimmed. A string such as `=A1` stays literal text in CSV or an Excel text cell. An actual Excel formula cell is rejected. This module does not execute formulas. A receiving application controls what it does with returned text.

CSV records must have the same number of fields as the header. XLSX stores sparse cells, so an omitted cell inside the table is treated as empty. The first worksheet row supplies headers; selected-sheet rows are read regardless of visibility or filters. Merged values are not expanded, and blank or merged headers are unsupported. Incorrectly understated XLSX dimensions do not silently hide stored rows: the reader uses openpyxl's documented [dimension reset](https://openpyxl.readthedocs.io/en/stable/optimized.html#worksheet-dimensions).

`ImportReport` contains immutable tuples: `accepted` holds `Identifier(row, value)`, while `skipped` and `rejected` hold `RowNotice(row, reason)`. `total_rows` equals the sum of the three categories. `values` returns accepted strings as a tuple. CSV row numbers count logical records, starting with the header as record 1; a quoted multiline cell remains one record. XLSX numbers correspond to worksheet rows.

Limits: 5,000,000 input bytes, 10,000 data records, 256 columns and 100,000 Unicode characters per cell. XLSX archive members may total at most 50,000,000 uncompressed bytes. Declared worksheet dimensions must also fit the row/column bounds. Oversized or malformed input raises `ImportFailure` instead of returning a partial result. A lower process-wide `csv.field_size_limit()` can cause `INVALID_CSV`; the module does not change that global setting.

`ImportFailure.code` is a fixed code such as `INVALID_ENCODING`, `INVALID_CSV`, `INVALID_XLSX`, `INVALID_HEADER`, `DUPLICATE_HEADER`, `COLUMN_NOT_FOUND`, `SHEET_NOT_FOUND`, `MAX_ROWS` or `READ_ERROR`; some errors also include a logical `row`. Errors and notices do not echo rejected values or file paths. The functions read local files and return data; they make no network requests and do not modify the files.

## Verify the handoff to a generator

From this directory:

```sh
python -m pip install -r requirements-demo.txt
python -m unittest -v
python qr_example.py
```

[`qr_example.py`](qr_example.py) reads a temporary synthetic CSV and passes each accepted string to the established [`qrcode` library](https://pypi.org/project/qrcode/8.2/). It builds QR matrices in memory and verifies the original UTF-8 bytes at the encoder's input. It writes no images and uses no printer or GUI. Any rejected record stops this example before generation. The small example allows at most 100 identifiers and 1,024 UTF-8 bytes per identifier; applications need their own batch and output policies.

Verified with Python 3.12.14, openpyxl 3.1.5 and qrcode 8.2. The 30 tests cover import contracts, malformed and oversized input, unchanged source files, understated worksheet dimensions, and the real QR encoder handoff. CSV tests also run without third-party packages:

```sh
python -S -m unittest -v test_identifier_import.CsvTests
```

The QR checks establish the text passed to encoding and matrix generation. They do not establish scanner compatibility, printed output quality or integration with another application's generation, preview or export paths.

## Applying the reported import case

[qr-generator issue #38](https://github.com/Malboro66/qr-generator/issues/38) describes identifiers being changed by pandas inference and different behavior when its CSV fallback is used. A synthetic reproduction with pandas 2.2.3 produced `['123.0', '7.0']` from `00123`, `00007`, `NA`. Converting those inferred values back to strings cannot restore the missing text.

This module provides one CSV parsing path and one XLSX text-cell contract. An application can keep a DataFrame as a display view, but it should create that view from already-preserved strings and keep the import report beside it. It should not reparse identifiers with numeric or missing-value inference, or apply `strip()`, `int()` or `float()` to accepted text before generation.

For that project's future consolidated base, wire the report into the import/column-selection boundary, show skipped and rejected counts with record numbers, and pass reviewed strings into the text generation path. Test preview, batch generation and any explicitly configured prefix/suffix or numeric mode separately. [Base consolidation #33](https://github.com/Malboro66/qr-generator/issues/33) was still open when this example was prepared. This is an independent reference implementation; the upstream application and its integration suite have not been run.

## Buy me a coffee, if this helped

If this saved you a little time, you're welcome to buy me a coffee. Please don't feel obliged — the code stays free, and feedback with a small synthetic case is appreciated too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please match the asset and network exactly. Fees depend on your wallet or exchange. Thank you! — Tevinch
