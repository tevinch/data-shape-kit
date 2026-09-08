# Data Shape Kit

Data Shape Kit is a small command-line tool for deterministic CSV cleanup, privacy-preserving profile summaries, value-free Markdown data dictionaries, exact-key comparisons, batch structure checks, social card metadata checks, podcast RSS checks, robots.txt checks, XML sitemap checks, tab-delimited product feed checks, redirect-map checks, and offline product import preflight reports. It normalizes headers, trims surrounding cell whitespace, removes exact duplicate rows, and reports aggregate checks locally.

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

Run static checks on a site-migration redirect map:

```bash
data-shape-kit --redirect-preflight redirects.csv preflight.md
```

The redirect preflight checks exact headers, absolute HTTP(S) URL shape, permanent 301/308 codes, duplicate or conflicting sources, self redirects, redirect chains and cycles, and shared targets. The report contains issue codes, severity, counts, and source row numbers only, so it does not include source cell values. It does not make network requests, test deployed redirects, or judge page relevance, and it does not guarantee search performance.

Check the structure of every immediate CSV file in one local directory:

```bash
data-shape-kit --batch-preflight exports/ batch-report.md
```

The batch preflight reports file and row totals, schema groups, missing or invalid headers, UTF-8 failures, schema mismatches, and malformed rows. It uses stable file numbers: the report does not include file names, header names, and does not include source cell values. It does not read subdirectories and does not combine or modify files.

Run supported static checks on a tab-delimited Merchant product feed:

```bash
data-shape-kit --merchant-feed-preflight products.tsv preflight.md
```

The file must be UTF-8 tab-delimited text. The check covers exact core attributes, missing values, duplicate IDs, malformed rows, supported availability and condition values, positive numeric price plus three-letter currency format, HTTP(S) URL shape, and the preorder date dependency. The report contains finding codes, counts, and source row numbers only, so it does not include source cell values. It does not make network requests, access an account, or modify the input, and it does not guarantee approval, eligibility, visibility, traffic, or sales.

Run supported static checks on one XML sitemap or sitemap index:

```bash
data-shape-kit --sitemap-preflight sitemap.xml preflight.md
```

The check covers UTF-8 XML up to 50 MB, the standard roots and namespace, no more than 50,000 entries, required locations, absolute HTTP(S) URL shape, duplicates, multiple origins, and supported optional-field syntax. DTD and entity declarations are refused. The report contains finding codes, counts, and entry numbers only, so it does not include source URL values. It does not make network requests, access an account, or modify the input, and it does not guarantee crawling or indexing, search visibility, ranking, traffic, or sales.

Run supported static checks on one robots.txt file:

```bash
data-shape-kit --robots-preflight robots.txt preflight.md
```

The check covers UTF-8 text up to 500 KiB, supported fields, group association, rule-path shape, absolute HTTP(S) sitemap locations, duplicate or conflicting rules, and a full-site crawl block for the wildcard group. The report contains finding codes, counts, and line numbers only, so it does not include source directive values. It does not make network requests, access an account, or modify the input, and it does not guarantee crawling or indexing, search visibility, ranking, traffic, or sales.

Run supported static checks on one public podcast RSS file:

```bash
data-shape-kit --podcast-feed-preflight feed.xml preflight.md
```

The check covers UTF-8 XML up to 10 MB, RSS 2.0 channel structure, show artwork, episode titles, enclosure components and uniqueness, GUID presence and uniqueness, and supported date syntax. DTD and entity declarations are refused. The report contains finding codes, counts, and episode numbers only, so it does not include source feed values. It does not make network requests, access an account, download media, or modify the input, and it does not guarantee platform acceptance, listing, availability, playback, traffic, or sales.

Run supported static checks on Open Graph metadata in one public HTML snapshot:

```bash
data-shape-kit --social-card-preflight page.html preflight.md
```

The check covers UTF-8 HTML up to 10 MB, required Open Graph properties, the recommended description and image alternative, public HTTP(S) URL shape, exact duplicate images, supported numeric image dimensions, and placement inside `head`. The report contains finding codes, counts, and meta-tag numbers only, so it does not include source metadata values. It does not make network requests, access an account, execute scripts, download images, or modify the input, and it does not guarantee a preview, platform behavior, clicks, traffic, or sales.

## Data privacy

Processing is local. The tool has no runtime dependencies, makes no network requests, and does not retain a copy of the input. Profile and dictionary modes hold distinct values only in process memory while counting. Preflight and comparison modes hold the values needed for supported within-file checks only in process memory. These reports do not include source cell or URL values. Normalized field names, source row numbers, and entry numbers are metadata and should still be treated as potentially sensitive.

## Limitations

- Input must be UTF-8 CSV with one header row; the eBay mode also accepts leading `#INFO` rows.
- Every data row must contain the same number of columns as the header.
- Duplicate detection is exact after trimming surrounding whitespace; it does not perform fuzzy matching.
- Shopify preflight is not an exhaustive validator and does not access store state.
- WooCommerce preflight is not an exhaustive validator and does not access store state, extensions, or custom mappings.
- eBay preflight supports listing and draft files with `Add` or `Draft` actions only; it does not access Seller Hub, category state, seller settings, business policies, fees, or upload results.
- CSV comparison requires the exact key header once in each file. Duplicate keys are not matched, and only exact common headers are compared.
- Redirect-map preflight is a static file check for absolute HTTP(S) URLs and permanent 301/308 mappings. It does not access a site or verify deployed behavior.
- Batch preflight reads immediate CSV files only and reports stable file numbers instead of names.
- Merchant feed preflight covers one UTF-8 tab-delimited file and supported static rules only.
- XML sitemap preflight covers one uncompressed UTF-8 XML file and supported static rules only.
- robots.txt preflight covers one UTF-8 text file and supported static rules only.
- Podcast RSS preflight covers one already-public UTF-8 XML snapshot and supported static rules only.
- Social card metadata preflight covers one already-public UTF-8 HTML snapshot and supported static Open Graph rules only.

## License

MIT
