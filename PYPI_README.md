# Data Shape Kit

Data Shape Kit is a small command-line tool for deterministic CSV cleanup, privacy-preserving profile summaries, value-free Markdown data dictionaries, exact-key comparisons, and offline product import preflight reports. It normalizes headers, trims surrounding cell whitespace, removes exact duplicate rows, and reports aggregate checks locally.

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

Run supported local checks on a Shopify product CSV before reviewing an import:

```bash
data-shape-kit --shopify-preflight products.csv preflight.md
```

The preflight checks the exact `Title` header, current `URL handle` or legacy `Handle`, non-empty handle characters, contiguous handle groups, and matching Option1 headers when variant fields contain data. It writes only aggregate issue codes, severity, counts, and source row numbers; it does not include source cell values. An exit status of 1 means findings were reported. The result covers supported local checks only and does not guarantee import acceptance.

Run supported local checks on a WooCommerce product CSV before reviewing an import:

```bash
data-shape-kit --woocommerce-preflight products.csv preflight.md
```

The preflight checks the exact `Name` header, documented `Type` and `Published` values, repeated non-empty SKU values within the file, `Parent` on variation rows, and paired numbered attribute name/value columns. It writes only aggregate issue codes, severity, counts, and source row numbers; it does not include source cell values. An exit status of 1 means findings were reported. The result covers supported local checks only and does not guarantee import acceptance.

Run supported local checks on an eBay Seller Hub Reports listing or draft CSV before reviewing an upload:

```bash
data-shape-kit --ebay-preflight listings.csv preflight.md
```

The preflight preserves leading `#INFO` rows, supports `Add` and `Draft` files, and checks documented file-level rules for `Action`, `Category ID`, `Title`, required listing fields, formats, image URLs, schedules, SKUs, and `Relationship details`. It writes only aggregate issue codes, severity, counts, and source row numbers; it does not include source cell values. An exit status of 1 means findings were reported. The result covers supported local checks only and does not guarantee upload acceptance.

Compare two local CSV files with one exact, unique key:

```bash
data-shape-kit --compare-to current.csv --key "SKU" previous.csv comparison.md
```

The comparison reports schema counts, missing and duplicate keys, rows found on only one side, changed row pairs, and matched unchanged rows. It compares exact common headers and does not modify either input. The report contains counts and old/new source row numbers only, so it does not include source cell values, header names, key values, or file names. Duplicate keys are reported as ambiguous and are not matched.

## Data privacy

Processing is local. The tool has no runtime dependencies, makes no network requests, and does not retain a copy of the input. Profile and dictionary modes hold distinct values only in process memory while counting. Preflight and comparison modes hold the values needed for supported within-file checks only in process memory. These reports do not include source cell values. Normalized field names and source row numbers are metadata and should still be treated as potentially sensitive.

## Limitations

- Input must be UTF-8 CSV with one header row; the eBay mode also accepts leading `#INFO` rows.
- Every data row must contain the same number of columns as the header.
- Duplicate detection is exact after trimming surrounding whitespace; it does not perform fuzzy matching.
- Shopify preflight is not an exhaustive validator and does not access store state.
- WooCommerce preflight is not an exhaustive validator and does not access store state, extensions, or custom mappings.
- eBay preflight supports listing and draft files with `Add` or `Draft` actions only; it does not access Seller Hub, category state, seller settings, business policies, fees, or upload results.
- CSV comparison requires the exact key header once in each file. Duplicate keys are not matched, and only exact common headers are compared.

## License

MIT
