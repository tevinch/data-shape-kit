# Data Shape Kit

A small Python command-line tool for deterministic CSV cleanup, privacy-preserving profile summaries, value-free Markdown data dictionaries, and offline product import preflight reports. It normalizes headers, trims surrounding cell whitespace, removes exact duplicate rows, and reports aggregate checks locally.

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
python -m pip install "data-shape-kit @ https://github.com/tevinch/data-shape-kit/archive/refs/tags/v0.4.0.tar.gz"
```

The tag keeps the installed source pinned to version 0.4.0. This method needs network access during installation but does not require Git; the installed tool itself has no runtime dependencies or network requests.

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

Run supported local checks on a Shopify product CSV before reviewing an import:

```bash
data-shape-kit --shopify-preflight products.csv preflight.md
```

The preflight checks the exact `Title` header, current `URL handle` or legacy `Handle`, non-empty handle characters, contiguous handle groups, and the presence of matching Option1 headers when variant fields contain data. It writes only aggregate issue codes, severity, counts, and source row numbers; it does not include source cell values. An exit status of 1 means findings were reported. The result covers supported local checks only and does not guarantee import acceptance.

The checks follow Shopify's current [product CSV format](https://help.shopify.com/en/manual/products/import-export/using-csv) and [import troubleshooting](https://help.shopify.com/en/manual/products/import-export/import-products) guidance. Shopify documents backward compatibility for older column names, so both current and legacy handle/header families are supported here.

Use the [Shopify product CSV preflight checklist](docs/shopify-product-csv-preflight-checklist.md) for a backup-first review sequence, finding explanations, and official references.

## Test

```bash
PYTHONPATH=src python -m unittest discover -s tests -v
```

## Data privacy

Processing is local. The tool has no runtime dependencies, makes no network requests, and does not retain a copy of the input. Profile and dictionary modes hold distinct values only in process memory while counting. Preflight mode holds handles in process memory only while checking group order. These reports do not include source cell values. Normalized field names and source row numbers are metadata and should still be treated as potentially sensitive.

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

## Fixed-price Shopify product CSV preflight

Need a product file reviewed before you handle an import? Choose one fixed scope:

| Tier | File limit | Delivery |
| --- | --- | --- |
| **USD 25 Report** | One UTF-8 Shopify product CSV, up to 500 rows and 10 MB | A local report covering exact headers, handle format and grouping, row shape, and supported variant/Option1 dependencies. The source file is not changed. |
| **USD 75 Correct** | One UTF-8 Shopify product CSV, up to 5,000 rows and 10 MB | The report, one corrected product CSV with agreed deterministic corrections, a change log, and a second report. |
| **USD 150 Full** | One UTF-8 Shopify product CSV, up to 50,000 rows and 10 MB | The Correct delivery plus a review of supported findings and one revision limited to the agreed checks and corrections. |

[Open a Shopify product CSV preflight request](https://github.com/tevinch/data-shape-kit/issues/new?template=shopify-product-csv-preflight-request.yml) with the tier, intended import action, header family, a small synthetic or redacted sample, a deadline, and exact acceptance criteria. This service is an independent local file review. Every tier covers only the supported checks and does not guarantee import acceptance because store state and platform behavior remain outside the file. No store login, admin access, API credentials, production upload, actual import, website retrieval, payment processing, infrastructure change, or security work is included. Do not attach confidential, personal, or production data to a public issue. Scope, delivery, and a private file-transfer method are confirmed before any real file is shared.

## Limitations

- Input must be UTF-8 CSV with one header row.
- Every data row must contain the same number of columns as the header.
- Duplicate detection is exact after trimming surrounding whitespace; it does not perform fuzzy matching.
- Shopify preflight is not an exhaustive validator and does not access store state.

## License

MIT
