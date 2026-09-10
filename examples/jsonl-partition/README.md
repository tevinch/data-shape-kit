# JSONL partition

Separate readable JSON objects from malformed physical lines before importing a JSONL file. Accepted records keep their original bytes; rejected lines go to a separate file with original line numbers, byte offsets and reasons. Python 3.11+, standard library only, MIT licensed.

[Download source and tests v0.1.0](../../downloads/jsonl-partition-v0.1.0.zip?raw=true) · [Polars example output](../../downloads/jsonl-partition-example.json)

## Why this exists

In [Polars #13768](https://github.com/pola-rs/polars/issues/13768), a single `x` between two JSON objects prevents the whole file from loading. The same input raises `ComputeError` in both `read_ndjson` and `scan_ndjson` on Polars 1.44.2, including with `ignore_errors=True`. The [documented option](https://docs.pola.rs/api/python/stable/reference/api/polars.read_ndjson.html) covers schema mismatches. The proposed [upstream change #24295](https://github.com/pola-rs/polars/pull/24295) was still open when checked on 10 September 2026.

This helper separates lines before Polars reads them, including malformed lines at the start of a file. It records every omission so you can inspect the rejected data. If you only need a Python iterator that skips invalid records, [jsonlines already provides `skip_invalid=True`](https://jsonlines.readthedocs.io/en/latest/); that may be sufficient for your application.

## Try a local file

Extract the ZIP and run commands inside its `jsonl-partition` directory. Save this invented three-line input as `input.jsonl`:

```text
{"a": 1,"b": 3}
x
{"a": 4,"b": 2}
```

Choose an output directory that does not already exist:

```sh
python jsonl_partition.py input.jsonl --output-dir partitioned
```

The command prints counts and creates four local files:

| File | Contents |
| --- | --- |
| `accepted.ndjson` | Original bytes of accepted object lines, in original order |
| `rejected.bin` | Original bytes of rejected lines, including invalid UTF-8 and line endings |
| `issues.ndjson` | One metadata record per rejected line: location and reason, without input contents |
| `summary.json` | Physical-line and byte counts for the completed partition |

The sample produces two accepted records and one rejected record at original line 2. Exit code 0 means the partition completed; check the `rejected` count before deciding whether the accepted subset is suitable. It does not mean the input had no problems.

An existing output directory is refused, even if empty. Input is opened before any output directory is created. The input file is not changed. An I/O failure returns a nonzero exit code and may leave partial files; use a new directory when retrying. A successful run and its valid summary indicate completion.

## Use with Polars

Polars is optional. To run the included integration example in an environment where you want Polars installed:

```sh
python -m pip install -r requirements-integration.txt
python polars_example.py
```

The example uses invented data in memory and prints the accepted eager/lazy results plus rejection metadata. It is repeatable and makes no file writes or network requests. The integration dependency is pinned to Polars 1.44.2.

After the earlier CLI command, read its accepted file with your intended schema:

```python
import polars as pl

schema = {"a": pl.Int64, "b": pl.Int64}
rows = pl.read_ndjson("partitioned/accepted.ndjson", schema=schema)
lazy_rows = pl.scan_ndjson("partitioned/accepted.ndjson", schema=schema).collect()
assert rows.to_dicts() == lazy_rows.to_dicts() == [{"a": 1, "b": 3}, {"a": 4, "b": 2}]
```

Successful line validation does not establish a compatible table schema. Numeric ranges, column types, missing/extra fields and nested structures remain subject to the downstream reader. Supply the schema appropriate to your data and handle any resulting errors.

## Copy the stream helper

Copy `jsonl_partition.py` beside your script. Importing it does not read or write files.

```python
from dataclasses import asdict
from io import BytesIO, StringIO
from jsonl_partition import partition_jsonl

source = BytesIO(b'{"a": 1,"b": 3}\nx\n{"a": 4,"b": 2}\n')
accepted, rejected, issues = BytesIO(), BytesIO(), StringIO()
stats = partition_jsonl(source, accepted, rejected, issues)
print(asdict(stats))
print(issues.getvalue())
assert rejected.getvalue() == b"x\n"
```

`partition_jsonl(source, accepted, rejected, issues, *, max_line_bytes=8 * 1024 * 1024)` returns a frozen `PartitionStats` with `lines`, `accepted`, `rejected`, `source_bytes`, `accepted_bytes`, and `rejected_bytes`. Line counts and byte counts each partition the total exactly.

Provide distinct blocking streams: binary input, binary accepted/rejected outputs, and a text metadata output. Input must support `readline(size)`. No seeking, `tell()` or stream closing is required. The caller owns the streams and must ensure separately opened handles do not refer to the same underlying file. I/O errors propagate; caller-owned outputs may then contain partial results.

Each issue has `line` (1-based original line number), `source_offset` (0-based byte offset in the original input), `byte_length` (complete physical line), `rejected_offset` (0-based byte offset in the rejected output), `code`, and a short `detail`. Metadata does not include line contents. The quarantine file does contain them and should stay with your local data.

## Validation and limits

The input format is one UTF-8 JSON object per physical LF-delimited line. CRLF is supported; a final line need not have a terminator. Escaped `\n` inside a JSON string stays inside that record. Blank lines are rejected and counted. Accepted and rejected output retain original spacing, numeric spelling and line-ending bytes.

The default maximum is 8 MiB **per physical line, including its line terminator**. Change it with `--max-line-bytes N` or the Python keyword. The limit must be a positive integer. An oversized line is streamed completely to the rejected output in bounded chunks, creates one issue, and does not prevent later lines from being checked. Memory use depends on the configured line limit and Python JSON decoding overhead.

| Issue code | Reason |
| --- | --- |
| `line_too_long` | The complete physical line exceeds the configured byte limit |
| `invalid_utf8` | The line cannot be decoded as UTF-8 |
| `blank_line` | The line consists only of JSON whitespace |
| `invalid_json` | Invalid syntax, a UTF-8 BOM, or a Python decoder/runtime limit |
| `non_object` | A valid JSON value whose top level is an array, scalar or null |
| `duplicate_key` | Repeated object keys, including inside nested objects |
| `non_finite_number` | NaN, Infinity, -Infinity or a number overflowing Python's finite float range |
| `invalid_unicode` | A decoded string or key contains an unpaired surrogate code point |

Duplicate keys are rejected to avoid ambiguous records. The helper never repairs or reserializes accepted records. It does not handle multiline pretty-printed JSON, compressed files, directory scanning, schema repair, JSON Schema validation or source mapping for accepted rows. Python's decoder limits apply. Parsing each accepted record again in Polars adds work; this is a preprocessing option with no throughput guarantee.

## Run checks

Standard-library unit and CLI tests:

```sh
python -m unittest discover -s test -p 'test_partition.py' -v
```

After installing the optional requirements, run all tests, including actual Polars operations:

```sh
python -m unittest discover -s test -v
```

The integration tests skip if Polars is absent. The release verification runs them with the pinned dependency and checks both eager and lazy imports, the original failing input, malformed first lines, CRLF/non-ASCII records and a remaining schema mismatch. Unit tests cover original bytes and offsets, bounded oversized reads, rejection reasons, output progress, I/O errors and new-directory CLI behavior.

## License

[MIT](LICENSE). Use, modify and share the code, retaining the license notice.

## Buy me a coffee, if this helped

This tool is free. If it saves you some time and you feel like buying me a coffee, a small contribution is welcome. There is no obligation; a useful example or feedback is appreciated too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please use the asset and network shown above.
