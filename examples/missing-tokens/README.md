# Missing Tokens

Free, copyable Python code for replacing declared missing-value markers in specific CSV columns. A measurement such as `NA` can become an empty cell while a profile code literally named `NA`, a leading-zero identifier and unrelated notes remain text. Python 3.10 or newer is enough; there are no third-party dependencies.

## Download and run the checks

[Download the source ZIP](https://github.com/tevinch/data-shape-kit/raw/refs/heads/main/downloads/missing-tokens-v0.1.0.zip), extract it, and run from the `missing-tokens` directory:

```sh
python -m unittest -v
```

For your application, copy [missing_tokens.py](missing_tokens.py) and [LICENSE](LICENSE). The module reads no files and makes no network or database calls. Your application supplies text and decides what to do with the result.

## Declare the meaning of each column

```python
import csv
import io
from missing_tokens import normalize_missing_csv

csv_text = (
    "profile_code,ph,depth_cm,note\n"
    '00060,NA,-9999,"NA, literal"\n'
    "NA,6.5,0,NULL\n"
)
result = normalize_missing_csv(
    csv_text,
    {
        "ph": ["NA", "NaN"],
        "depth_cm": ["-9999"],
    },
)
rows = list(csv.reader(io.StringIO(result.text, newline="")))
assert rows == [
    ["profile_code", "ph", "depth_cm", "note"],
    ["00060", "", "", "NA, literal"],
    ["NA", "6.5", "0", "NULL"],
]
assert result.replacements == {"ph": 1, "depth_cm": 1}
assert result.row_count == 2
```

The policy is explicit. This example declares `-9999` missing only in `depth_cm`; it does not assume that every negative number is missing. Zero remains `"0"`. No column is converted to a number, and no unlisted column is changed.

Matching applies to the **complete parsed field** and is case-sensitive and whitespace-sensitive. With `["NA"]`, the values `na`, ` NA ` and `BANANA` remain untouched. A quoted `"NA"` field and an unquoted `NA` field have the same parsed text, so quoting does not exempt a token. Add a spelling only when it means missing in that column.

## Prepare a separate file

This example expects a local `measurements.csv` with the columns used above. It writes a new file and refuses to overwrite an existing output:

```python
from pathlib import Path
from missing_tokens import normalize_missing_csv

with Path("measurements.csv").open(
    "r", encoding="utf-8-sig", newline=""
) as source:
    result = normalize_missing_csv(
        source.read(),
        {"ph": ["NA", "NaN"], "depth_cm": ["-9999"]},
    )

with Path("prepared.measurements.csv").open(
    "x", encoding="utf-8", newline=""
) as destination:
    destination.write(result.text)

print(result.replacements)
```

Inspect the replacement counts and prepared file before using it in your application. Keep the original input: replacing a sentinel with an empty field is intentionally irreversible in the output.

## API and validation

`normalize_missing_csv(text, tokens_by_column, *, delimiter=",")` returns a `NormalizedCSV` result:

| Attribute | Meaning |
| --- | --- |
| `text` | Rewritten CSV text |
| `replacements` | Actual nonempty-to-empty changes for each configured column, including zero counts |
| `row_count` | Number of data records, excluding the header |

Use lists, tuples, sets or frozensets of strings as token collections. A bare `"NA"` string is rejected as a collection so it cannot accidentally mean the separate characters `N` and `A`. Empty collections and an empty policy are valid. Configuring `""` makes no additional change and does not inflate the replacement count. The function does not mutate the supplied policy.

Headers are exact, case-sensitive names; they are not trimmed. Empty or duplicate names, unknown configured columns and records of the wrong width raise `ValueError`. Header-only CSV is accepted. Standalone blank records are rejected; correctly sized rows of empty fields are retained. Invalid argument types raise `TypeError`; parser failures can raise `csv.Error`. No result is returned for an invalid document.

A delimiter must be one character other than a double quote, carriage return, newline or NUL. Pass `delimiter=";"` for semicolon-separated files or `delimiter="\t"` for tab-separated text. The module does not guess the dialect.

## What is preserved, and what changes

The implementation uses Python's [standard CSV reader and writer](https://docs.python.org/3/library/csv.html). Fields are parsed as strings, without numeric inference. Embedded line breaks, delimiters, doubled quotes, Unicode, long digit strings and leading zeros survive as field values unless you explicitly select a matching field for replacement.

The output is **not byte-identical CSV**: record separators become CRLF, quoting is rewritten as needed and an initial UTF-8 text BOM is removed. This uses Python's CSV grammar with `strict=True`; it is not a validator for every interpretation of the CSV specifications. The standard-library field-size limit still applies. Input and output are held in memory, so this is not a streaming solution for very large files.

CSV has no universal null type. This helper writes empty strings, and the receiving application must interpret them as intended. An empty required identifier may still be invalid. It does not parse dates or locale-specific numbers, read XLSX, evaluate formulas, change application settings or restore characters already lost in an earlier import.

If you control the R export, its documented [`na` argument](https://stat.ethz.ch/R-manual/R-devel/library/utils/html/write.table.html) may let you write actual missing values as blanks at the source. Use this preprocessor when you receive an existing CSV or need different token policies for different columns.

## Why this exists

[OpenNSIS issue #7](https://github.com/un-fao/OpenNSIS/issues/7) requests configurable missing markers after R-exported `NA` values prevent successful import. At [upstream revision 2186370](https://github.com/un-fao/OpenNSIS/blob/2186370ccb94656e836e38e58e5d91f8baf95dfd/sis-api/main.py#L2674), upload preserves parsed strings; the [numeric-observation validation](https://github.com/un-fao/OpenNSIS/blob/2186370ccb94656e836e38e58e5d91f8baf95dfd/sis-api/main.py#L3718) skips empty strings but attempts to parse other values as numbers. This offers a separate preparation step for selected observation columns. It does **not** implement the requested options inside OpenNSIS or verify an end-to-end database import.

An independent [CSV text-coercion report](https://github.com/starlight-ml/dance_crm/issues/1) shows the opposite need: `NA`-like strings in text fields must stay literal. These reports motivate per-column policy; they do not measure how common the problem is. Avoid whole-file search-and-replace, which can change identifiers and parts of ordinary text.

## Verification

The 23 unit tests pass on Python 3.12.14, covering scoped replacement, literal text preservation, exact matching, quoted multiline fields, counts, delimiters, invalid shapes and policy validation. Both Python examples above were executed, including the refusal to overwrite an existing prepared file. The module and tests also pass Python 3.10 grammar parsing; the runtime checks used Python 3.12.14.

Original code is [MIT licensed](LICENSE); keep the notice when copying it.

## Buy me a coffee, if this helped

If this saved you some time, you're welcome to buy me a coffee. Please don't feel obliged — the code stays free, and useful feedback is welcome too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please match the asset and network exactly. Fees depend on your wallet or exchange. Thank you! — Tevinch
