# Data Shape Kit

Data Shape Kit is a small command-line tool for deterministic CSV cleanup, privacy-preserving profile summaries, and value-free Markdown data dictionaries. It normalizes headers, trims surrounding cell whitespace, removes exact duplicate rows, and reports aggregate shape counts locally.

## Requirements

- Python 3.11 or newer

## Install

```bash
python -m pip install data-shape-kit
```

## Use

```bash
data-shape-kit input.csv cleaned.csv
```

Example report:

```text
Input rows: 3
Output rows: 2
Duplicates removed: 1
```

The output keeps the first occurrence of each row after trimming surrounding whitespace. Column names are lowercased, converted to underscore-separated names, and made unique with numeric suffixes.

Profile a CSV without copying its cell values into the report:

```bash
data-shape-kit --profile input.csv profile.json
```

The JSON profile reports input row and column counts plus each normalized column's empty values and distinct non-empty values. It does not include source cell values.

Generate a Markdown data dictionary without copying source values into it:

```bash
data-shape-kit --dictionary input.csv dictionary.md
```

The dictionary reports each normalized field's position, observed data kind, non-empty and empty counts, and distinct non-empty count. The report does not include source cell values.

## Data privacy

Processing is local. The tool has no runtime dependencies, makes no network requests, and does not retain a copy of the input. Profile and dictionary modes hold distinct values only in process memory while counting and do not include source cell values in their outputs. Normalized field names are included in both reports and should be treated as potentially sensitive metadata.

## Limitations

- Input must be UTF-8 CSV with one header row.
- Every data row must contain the same number of columns as the header.
- Duplicate detection is exact after trimming surrounding whitespace; it does not perform fuzzy matching.

## License

MIT
