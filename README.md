# Data Shape Kit

A small Python command-line tool for deterministic CSV cleanup, privacy-preserving profile summaries, and value-free Markdown data dictionaries. It normalizes headers, trims surrounding cell whitespace, removes exact duplicate rows, and reports aggregate shape counts locally.

## Requirements

- Python 3.11 or newer

## Install

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install --no-deps -e .
```

Install the verified public version directly from its fixed Git tag:

```bash
python -m pip install "data-shape-kit @ https://github.com/tevinch/data-shape-kit/archive/refs/tags/v0.3.0.tar.gz"
```

The tag keeps the installed source pinned to version 0.3.0. This method needs network access during installation but does not require Git; the installed tool itself has no runtime dependencies or network requests.

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

Profile a CSV without copying its cell values into the report:

```bash
data-shape-kit --profile input.csv profile.json
```

The JSON profile reports input row and column counts plus each normalized column's empty values and distinct non-empty values. It does not include source cell values.

Generate a Markdown data dictionary without copying source values into it:

```bash
data-shape-kit --dictionary input.csv dictionary.md
```

The dictionary reports each normalized field's position, observed data kind, non-empty and empty counts, and distinct non-empty count. The observed data kind is a conservative summary: boolean, integer, decimal, ISO date, ISO datetime, text, mixed, or empty. The report does not include source cell values.

## Test

```bash
PYTHONPATH=src python -m unittest discover -s tests -v
```

## Data privacy

Processing is local. The tool has no runtime dependencies, makes no network requests, and does not retain a copy of the input. Profile and dictionary modes hold distinct values only in process memory while counting and do not include source cell values in their outputs. Normalized field names are included in both reports and should be treated as potentially sensitive metadata.

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

## Fixed-price CSV reporting pipeline

Need one repeatable command that turns a source export into review-ready files? A USD 100 fixed-price reporting pipeline includes:

- one UTF-8 CSV up to 10 MB;
- up to five deterministic field rules and one grouping key agreed from a synthetic or redacted sample;
- a standalone Python command and test suite that produces up to three CSV outputs: normalized detail, grouped summary, and exception rows;
- an output-column and calculation guide; and
- one revision limited to the rules and outputs agreed before work starts.

[Open a CSV reporting pipeline request](https://github.com/tevinch/data-shape-kit/issues/new?template=csv-reporting-pipeline-request.yml) with numbered rules, the grouping key, required output columns, a small safe sample, a deadline, and exact acceptance criteria. Every result must be reproducible from the input; open-ended analysis and subjective classification are outside the fixed scope. No account access, external API integration, production-system upload, authentication, payment processing, infrastructure change, or security work is included. Do not attach confidential, personal, or production data to a public issue.

## Fixed-price CSV data dictionary

Need a field guide and import handoff for a small CSV export? A USD 125 fixed-price delivery includes:

- one UTF-8 CSV up to 10 MB and up to 100 columns;
- a Markdown data dictionary with agreed field definitions, required/optional status, and data kinds;
- a machine-readable field specification and an import readiness checklist;
- a local summary of completeness and distinct non-empty counts without source values in the report; and
- one revision limited to the agreed fields and import requirements.

[Open a CSV data dictionary request](https://github.com/tevinch/data-shape-kit/issues/new?template=csv-data-dictionary-request.yml) with the field list, known definitions and types, a small synthetic or redacted sample, the target import context, a deadline, and exact acceptance criteria. Field definitions and requirements are agreed before real data is shared. No account access, external API integration, production-system upload, authentication, payment processing, infrastructure change, or security work is included. Do not attach confidential, personal, or production data to a public issue.

## Limitations

- Input must be UTF-8 CSV with one header row.
- Every data row must contain the same number of columns as the header.
- Duplicate detection is exact after trimming surrounding whitespace; it does not perform fuzzy matching.

## License

MIT
