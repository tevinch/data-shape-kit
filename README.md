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

## Limitations

- Input must be UTF-8 CSV with one header row.
- Every data row must contain the same number of columns as the header.
- Duplicate detection is exact after trimming surrounding whitespace; it does not perform fuzzy matching.

## License

MIT
