# Data Shape Kit

A small Python command-line tool for deterministic CSV cleanup. It normalizes headers, trims surrounding cell whitespace, removes exact duplicate rows, and prints a concise report.

## Requirements

- Python 3.11 or newer

## Install

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install --no-deps -e .
```

## Use

```bash
data-shape-kit examples/customers.csv cleaned.csv
```

Example report:

```text
Input rows: 3
Output rows: 2
Duplicates removed: 1
```

The output keeps the first occurrence of each row after trimming surrounding whitespace. Column names are lowercased, converted to underscore-separated names, and made unique with numeric suffixes.

## Test

```bash
PYTHONPATH=src python -m unittest discover -s tests -v
```

## Data privacy

Processing is local. The tool has no runtime dependencies, makes no network requests, and does not retain a copy of the input.

## Fixed-price CSV cleanup

Need this cleanup applied to a small dataset without setting up the tool yourself? A USD 25 fixed-price cleanup includes:

- one UTF-8 CSV up to 10 MB;
- header normalization, surrounding-whitespace trimming, and exact duplicate removal;
- a cleaned CSV and a short input/output row-count report; and
- one revision limited to the cleanup rules agreed before work starts.

[Open a CSV cleanup request](https://github.com/tevinch/data-shape-kit/issues/new?template=csv-cleanup-request.yml) with a small synthetic or redacted sample, the expected output, a deadline, and acceptance criteria. Do not attach confidential, personal, or production data to a public issue. A request is a fit check, not an agreement to begin work; private file-transfer details and the delivery date are confirmed before any real data is shared.

## Fixed-price CSV transformation

Need a repeatable conversion that goes beyond cleanup? A USD 50 fixed-price transformation includes:

- one UTF-8 CSV up to 10 MB;
- up to five deterministic column rules agreed from a synthetic or redacted sample;
- a standalone Python script and test suite, the transformed CSV, and a short input/output row-count report; and
- one revision limited to the rules agreed before work starts.

[Open a CSV transformation request](https://github.com/tevinch/data-shape-kit/issues/new?template=csv-transformation-request.yml) with the input/output columns, numbered rules, a small safe sample, a deadline, and acceptance criteria. No account access, external API integration, production-system upload, authentication, payment processing, infrastructure change, or security work is included. Do not attach confidential, personal, or production data to a public issue. A request is a fit check; scope, delivery, and private file transfer are confirmed before any real data is shared.

## Fixed-price CSV validation

Need a repeatable pre-import check without changing the source file? A USD 75 fixed-price validation includes:

- one UTF-8 CSV up to 10 MB;
- up to five reproducible validation rules, such as required values, unique keys, allowed values, regular expressions, numeric ranges, or ISO dates;
- a read-only Python command and test suite, a row-level CSV violation report, and a short summary; and
- one revision limited to the rules agreed before work starts.

[Open a CSV validation request](https://github.com/tevinch/data-shape-kit/issues/new?template=csv-validation-request.yml) with numbered rules, affected columns, a small synthetic or redacted sample, the expected report, a deadline, and acceptance criteria. The validator does not modify your input. No account access, external API integration, production-system upload, authentication, payment processing, infrastructure change, or security work is included. Do not attach confidential, personal, or production data to a public issue.

## Limitations

- Input must be UTF-8 CSV with one header row.
- Every data row must contain the same number of columns as the header.
- Duplicate detection is exact after trimming surrounding whitespace; it does not perform fuzzy matching.

## License

MIT
