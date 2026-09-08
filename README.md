# Data Shape Kit

A small Python command-line tool for deterministic CSV cleanup, privacy-preserving profile summaries, value-free Markdown data dictionaries, exact-key comparisons, batch structure checks, XML sitemap checks, tab-delimited product feed checks, redirect-map checks, and offline product import preflight reports. It normalizes headers, trims surrounding cell whitespace, removes exact duplicate rows, and reports aggregate checks locally.

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
python -m pip install "data-shape-kit @ https://github.com/tevinch/data-shape-kit/archive/refs/tags/v0.11.0.tar.gz"
```

The tag keeps the installed source pinned to version 0.11.0. This method needs network access during installation but does not require Git; the installed tool itself has no runtime dependencies or network requests.

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

Run supported local checks on a WooCommerce product CSV before reviewing an import:

```bash
data-shape-kit --woocommerce-preflight products.csv preflight.md
```

The preflight checks the exact `Name` header, documented `Type` and `Published` values, repeated non-empty SKU values within the file, `Parent` on variation rows, and paired numbered attribute name/value columns. It writes only aggregate issue codes, severity, counts, and source row numbers; it does not include source cell values. An exit status of 1 means findings were reported. The result covers supported local checks only and does not guarantee import acceptance.

The checks follow WooCommerce's current [built-in product CSV schema](https://woocommerce.com/document/product-csv-importer-exporter/). Because the importer's mapping screen can map custom headers, a missing exact `Name` header is a warning rather than proof that an import will fail.

Use the [WooCommerce product CSV preflight checklist](docs/woocommerce-product-csv-preflight-checklist.md) for a backup-first review sequence, finding explanations, and the official reference.

Run supported local checks on an eBay Seller Hub Reports listing or draft CSV before reviewing an upload:

```bash
data-shape-kit --ebay-preflight listings.csv preflight.md
```

The preflight preserves leading `#INFO` rows while locating the exact header row, then checks supported `Action`, `Category ID`, `Title`, `Start price`, `Quantity`, `Item photo URL`, `Condition ID`, `Description`, `Format`, `Duration`, `Schedule Time`, SKU, and `Relationship details` rules. It supports `Add` and `Draft` files; other action types are reported as outside the current check. The report contains only issue codes, severity, counts, and source row numbers, so it does not include source cell values. An exit status of 1 means findings were reported. The result covers supported local checks only and does not guarantee upload acceptance.

The checks follow eBay's current [Seller Hub Reports help](https://www.ebay.com/help/selling/selling-tools/seller-hub-reports?id=4096) and [inventory onboarding guide](https://pages.ebay.com/sh/reports/help/create-listings-bulk/). Category-specific item requirements, seller settings, business policies, fees, listing eligibility, and the upload results remain outside the local file check.

Use the [eBay listing file preflight checklist](docs/ebay-listing-file-preflight-checklist.md) for a backup-first review sequence, finding explanations, and official references.

Compare two local CSV files with one exact, unique key:

```bash
data-shape-kit --compare-to current.csv --key "SKU" previous.csv comparison.md
```

The comparison reports added, removed, or reordered columns; missing and duplicate keys; rows found on only one side; changed row pairs; and the number of matched unchanged rows. It compares all exact common headers and does not modify either input. The Markdown report contains counts and old/new source row numbers only, so it does not include source cell values, header names, key values, or file names. Duplicate keys are reported as ambiguous and are not matched.

Use the [CSV comparison report checklist](docs/csv-comparison-report-checklist.md) to confirm key stability, file safety, and the fixed report scope.

Run static checks on a site-migration redirect map:

```bash
data-shape-kit --redirect-preflight redirects.csv preflight.md
```

The CSV must use the exact `Source URL`, `Target URL`, and `Status Code` headers. The preflight checks absolute HTTP(S) URL shape, permanent 301/308 codes, duplicate or conflicting sources, self redirects, redirect chains and cycles, and targets shared by multiple sources. It writes issue codes, severity, counts, and source row numbers only, so it does not include source cell values. It does not make network requests, test deployed redirects, or judge whether two pages are meaningfully related, and it does not guarantee search performance.

The checks follow Google Search Central's current [site-move guidance](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes) and [redirect guidance](https://developers.google.com/search/docs/crawling-indexing/301-redirects).

Use the [redirect map preflight checklist](docs/redirect-map-preflight-checklist.md) for a mapping-first review sequence, finding explanations, and scope boundaries.

Check the structure of every immediate CSV file in one local directory:

```bash
data-shape-kit --batch-preflight exports/ batch-report.md
```

The batch preflight reports the file and row totals, schema-group count, missing or invalid headers, UTF-8 failures, schema mismatches, and malformed rows. It uses stable file numbers and row locations only: the report does not include file names, header names, or source cell values. It does not read subdirectories and does not combine or modify files. An exit status of 1 means findings were reported.

Use the [CSV batch preflight checklist](docs/csv-batch-preflight-checklist.md) for preparation, finding explanations, and fixed-scope service options.

Run supported static checks on a tab-delimited Merchant product feed:

```bash
data-shape-kit --merchant-feed-preflight products.tsv preflight.md
```

The file must be UTF-8 tab-delimited text. The check recognizes the exact core attributes `id`, `title` or `structured_title`, `description` or `structured_description`, `link`, `image_link`, `availability`, and `price`. It reports missing fields, duplicate IDs, malformed rows, supported availability and condition values, positive numeric price plus three-letter currency format, HTTP(S) URL shape, and the preorder date dependency. The report contains finding codes, counts, and source row numbers only, so it does not include source cell values. It does not make network requests, access an account, or modify the input, and it does not guarantee approval, eligibility, visibility, traffic, or sales.

The checks follow Google's current [product data specification](https://support.google.com/merchants/answer/7052112?hl=en), [tab-delimited file guidance](https://support.google.com/merchants/answer/14989239?hl=en), and [2026 specification update](https://support.google.com/merchants/answer/16989427?hl=en).

Use the [Merchant product feed preflight checklist](docs/merchant-product-feed-preflight-checklist.md) for exact scope, current sources, and preparation steps.

Run supported static checks on one XML sitemap or sitemap index:

```bash
data-shape-kit --sitemap-preflight sitemap.xml preflight.md
```

The check covers UTF-8 XML up to 50 MB, the `urlset` or `sitemapindex` root and standard namespace, no more than 50,000 entries, one `loc` per entry, absolute HTTP(S) URL shape, duplicate locations, multiple origins, and supported `lastmod`, `changefreq`, and `priority` syntax. DTD and entity declarations are refused. The report contains finding codes, counts, and entry numbers only, so it does not include source URL values. It does not make network requests, access an account, or modify the input, and it does not guarantee crawling or indexing, search visibility, ranking, traffic, or sales.

The checks follow Google Search Central's current [sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap?hl=en) and the [Sitemaps protocol](https://www.sitemaps.org/protocol.html). Google ignores `priority` and `changefreq`; this command checks their protocol syntax only when they are present.

Use the [XML sitemap preflight checklist](docs/xml-sitemap-preflight-checklist.md) for exact scope, finding explanations, and preparation steps.

## Test

```bash
PYTHONPATH=src python -m unittest discover -s tests -v
```

## Data privacy

Processing is local. The tool has no runtime dependencies, makes no network requests, and does not retain a copy of the input. Profile and dictionary modes hold distinct values only in process memory while counting. Preflight modes hold the values needed for supported within-file checks only in process memory. These reports do not include source cell or URL values. Normalized field names, source row numbers, and entry numbers are metadata and should still be treated as potentially sensitive.

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

## Fixed-price WooCommerce product CSV preflight

Need a built-in-importer product file reviewed before you handle an import? Choose one fixed scope:

| Tier | File limit | Delivery |
| --- | --- | --- |
| **USD 25 Report** | One UTF-8 WooCommerce product CSV, up to 500 rows and 10 MB | A local report covering the supported exact header, type, status, SKU, variation parent, and attribute-pair checks. The source file is not changed. |
| **USD 75 Correct** | One UTF-8 WooCommerce product CSV, up to 5,000 rows and 10 MB | The report, one corrected product CSV with agreed deterministic corrections, a change log, and a second report. |
| **USD 150 Full** | One UTF-8 WooCommerce product CSV, up to 50,000 rows and 10 MB | The Correct delivery plus a review of supported findings and one revision limited to the agreed checks and corrections. |

[Open a WooCommerce product CSV preflight request](https://github.com/tevinch/data-shape-kit/issues/new?template=woocommerce-product-csv-preflight-request.yml) with the tier, intended import action, mapping assumptions, a small synthetic or redacted sample, a deadline, and exact acceptance criteria. This service is an independent local file review for the built-in importer. Every tier covers only the supported checks and does not guarantee import acceptance because store state, extensions, custom mappings, remote files, and platform behavior remain outside the file. No store login, WordPress access, plugin installation, admin access, API credentials, production upload, actual import, website retrieval, payment processing, infrastructure change, or security work is included. Do not attach confidential, personal, or production data to a public issue. Scope, delivery, and a private file-transfer method are confirmed before any real file is shared.

## Fixed-price eBay listing file preflight

Need a Seller Hub Reports `Add` or `Draft` CSV reviewed before you handle an upload? Choose one fixed scope:

| Tier | File limit | Delivery |
| --- | --- | --- |
| **USD 25 Report** | One UTF-8 eBay listing or draft CSV, up to 500 rows and 10 MB | A local report covering the supported headers, actions, required listing fields, formats, image URLs, schedules, SKUs, and variation relationships. The source file is not changed. |
| **USD 75 Correct** | One UTF-8 eBay listing or draft CSV, up to 5,000 rows and 10 MB | The report, one corrected CSV with agreed deterministic corrections, a change log, and a second report. |
| **USD 150 Full** | One UTF-8 eBay listing or draft CSV, up to 50,000 rows and 10 MB | The Correct delivery plus a review of supported findings and one revision limited to the agreed checks and corrections. |

[Open an eBay listing file preflight request](https://github.com/tevinch/data-shape-kit/issues/new?template=ebay-listing-file-preflight-request.yml) with the tier, template source, intended action, eBay site, a small synthetic or redacted sample, a deadline, and exact acceptance criteria. This service is an independent local file review for supported `Add` and `Draft` files. Every tier covers only the documented checks and does not guarantee upload acceptance because category rules, seller settings, business policies, fees, listing eligibility, image availability, and later platform behavior remain outside the file. No seller account login, Seller Hub access, API credentials, production upload, actual listing action, image hosting, website retrieval, payment processing, infrastructure change, restricted-item review, or security work is included. Do not attach confidential, personal, or production data to a public issue. Scope, delivery, and a private file-transfer method are confirmed before any real file is shared.

## Fixed-price CSV comparison report

Need to validate two ordinary catalog or inventory exports without manually aligning rows? Choose one fixed scope:

| Tier | File limit | Delivery |
| --- | --- | --- |
| **USD 25 Report** | Two UTF-8 CSV files, up to 500 rows per file and 10 MB combined | One exact-key, all-common-column comparison report with counts and source row numbers only. No file changes. |
| **USD 75 Select** | Two UTF-8 CSV files, up to 5,000 rows per file and 20 MB combined | One exact-key comparison across up to 10 selected common columns, a reusable command, and one in-scope report revision. |
| **USD 150 Full** | Two UTF-8 CSV files, up to 50,000 rows per file and 50 MB combined | One exact-key, all-common-column report, a documented header-pairing plan for agreed header differences, a reusable command, and one in-scope revision. |

[Open a CSV comparison report request](https://github.com/tevinch/data-shape-kit/issues/new?template=csv-comparison-report-request.yml) with the tier, exact key, columns, a small synthetic or fully redacted sample, a deadline, and exact acceptance criteria. The standard report identifies schema changes, missing or duplicate keys, only-old or only-new rows, and changed row pairs without publishing source values. It does not modify either input. No account or shared-sheet access, cloud integration, production-system access, import, upload, payment processing, infrastructure change, or security work is included. No regulated, confidential, personal, financial, medical, education, identity, credential, or production data is accepted. Scope, delivery, and a private file-transfer method are confirmed before any real file is shared.

## Fixed-price redirect map preflight

Need a static review of a website migration mapping before your team configures redirects? Choose one fixed scope:

| Tier | File limit | Delivery |
| --- | --- | --- |
| **USD 25 Report** | One UTF-8 redirect map CSV, up to 500 mappings and 10 MB | A value-free report covering supported header, URL, status, duplicate, conflict, self-redirect, chain, cycle, and shared-target checks. No file changes. |
| **USD 75 Correct** | One UTF-8 redirect map CSV, up to 5,000 mappings and 10 MB | The report, one corrected map with agreed deterministic corrections, a change log, and a second report. |
| **USD 150 Full** | One UTF-8 redirect map CSV, up to 50,000 mappings and 25 MB | The Correct delivery plus a supported-findings review and one revision limited to the agreed checks and corrections. |

[Open a redirect map preflight request](https://github.com/tevinch/data-shape-kit/issues/new?template=redirect-map-preflight-request.yml) with the tier, exact headers, intended permanent redirects, a synthetic or publicly known URL sample, a deadline, and exact acceptance criteria. Real files must contain publicly known URLs only; private, staging, regulated, confidential, personal, financial, medical, education, identity, credential, or production data is outside scope. The static report does not test live HTTP responses, server rules, relevance, canonical tags, robots rules, sitemaps, or indexing, and it does not guarantee search performance. No site, server, CMS, analytics, or Search Console access, production deployment, infrastructure change, payment processing, or security work is included. Scope, delivery, and a private file-transfer method are confirmed before any real file is shared.

## Fixed-price CSV batch preflight and combine

Need a folder of ordinary CSV exports checked before a safe, deterministic merge? USD 25 Report covers up to 30 files, USD 75 Combine covers up to 100 files, and USD 150 Full covers up to 500 files.

| Tier | Batch limit | Delivery |
| --- | --- | --- |
| **USD 25 Report** | Up to 30 UTF-8 CSV files, 50,000 rows, and 25 MB total | One value-free structural report; no file changes. |
| **USD 75 Combine** | Up to 100 UTF-8 CSV files, 250,000 rows, and 100 MB total | The report, one combined CSV after preflight passes, a row-count reconciliation, and a change log. |
| **USD 150 Full** | Up to 500 UTF-8 CSV files, 1,000,000 rows, and 500 MB total | The Combine delivery, a reusable local command, and one in-scope revision. |

[Open a CSV batch preflight request](https://github.com/tevinch/data-shape-kit/issues/new?template=csv-batch-preflight-request.yml) with the tier, expected headers and file order, a synthetic or fully redacted sample, total size and rows, deadline, and exact acceptance criteria. The public issue and sample must contain no regulated, confidential, personal, financial, medical, education, identity, credential, or production data. No combine begins until the preflight passes and the agreed deterministic order is confirmed. No email, cloud-drive, SAP, or production-system access, account login, API integration, upload, payment processing, infrastructure change, or security work is included. Scope, delivery, and a private file-transfer method are confirmed before any real files are shared.

## Fixed-price Merchant product feed preflight

Need a tab-delimited product file checked before your team handles submission? USD 25 Report covers up to 500 rows, USD 75 Correct covers up to 5,000 rows, and USD 150 Full covers up to 50,000 rows.

| Tier | File limit | Delivery |
| --- | --- | --- |
| **USD 25 Report** | One UTF-8 tab-delimited product file, up to 500 rows and 10 MB | A value-free report covering the supported core attributes, row shape, IDs, URLs, availability, condition, and price format. No file changes. |
| **USD 75 Correct** | One eligible file, up to 5,000 rows and 20 MB | The report, one corrected file with agreed deterministic corrections, a change log, and a second report. |
| **USD 150 Full** | One eligible file, up to 50,000 rows and 50 MB | The Correct delivery, a supported-findings review, and one in-scope revision. |

[Open a Merchant product feed preflight request](https://github.com/tevinch/data-shape-kit/issues/new?template=merchant-product-feed-preflight-request.yml) with the tier, file format, exact headers, a synthetic or fully redacted sample, total size and rows, deadline, and acceptance criteria. Real work accepts publicly available product catalog data only; no regulated, confidential, personal, private pricing, cost, margin, financial, medical, education, identity, credential, unpublished, or production data. No Merchant Center, Google Ads, store, or production-system access, account login, API integration, website retrieval, submission, upload, policy appeal, payment processing, infrastructure change, or security work is included. The static check does not guarantee approval, eligibility, visibility, traffic, or sales. Scope, delivery, and a private file-transfer method are confirmed before any real file is shared.

## Fixed-price XML sitemap preflight

Need one public-site XML sitemap checked before your team handles deployment or submission? USD 25 Report covers up to 5,000 entries, USD 75 Correct covers up to 25,000 entries, and USD 150 Full covers up to 50,000 entries.

| Tier | File limit | Delivery |
| --- | --- | --- |
| **USD 25 Report** | One public-site XML sitemap or index, up to 5,000 entries and 10 MB | A value-free report covering the supported XML, root, namespace, entry, location, duplicate, origin, and optional-field checks. No file changes. |
| **USD 75 Correct** | One eligible file, up to 25,000 entries and 25 MB | The report, one corrected XML file with agreed deterministic corrections, a change log, and a second report. |
| **USD 150 Full** | One eligible file, up to 50,000 entries and 50 MB | The Correct delivery, a supported-findings review, and one in-scope revision. |

[Open an XML sitemap preflight request](https://github.com/tevinch/data-shape-kit/issues/new?template=xml-sitemap-preflight-request.yml) with the tier, root kind, a small synthetic or public sample, entry count, size, deadline, and acceptance criteria. Real work accepts a public website sitemap only; no private, staging, regulated, confidential, personal, identity, credential, or production data. No site, server, CMS, hosting, analytics, or Search Console access, account login, live URL retrieval, deployment, submission, upload, indexing request, infrastructure change, payment processing, or security work is included. The static check does not guarantee crawling or indexing, search visibility, ranking, traffic, or sales. Scope, delivery, and a private file-transfer method are confirmed before any real file is shared.

## Limitations

- Input must be UTF-8 CSV with one header row; the eBay mode also accepts leading `#INFO` rows.
- Every data row must contain the same number of columns as the header.
- Duplicate detection is exact after trimming surrounding whitespace; it does not perform fuzzy matching.
- Shopify preflight is not an exhaustive validator and does not access store state.
- WooCommerce preflight is not an exhaustive validator and does not access store state, extensions, or custom mappings.
- eBay preflight supports listing and draft files with `Add` or `Draft` actions only; it does not access Seller Hub, category state, seller settings, business policies, fees, or upload results.
- CSV comparison requires the exact key header once in each file. Duplicate key values are reported but not matched, and only exact common headers are compared unless a separate scope is agreed.
- Redirect-map preflight is a static file check for absolute HTTP(S) URLs and permanent 301/308 mappings. It does not access a site or verify deployed behavior.
- Batch preflight reads immediate CSV files only, reports stable file numbers instead of names, and never combines or modifies files.
- Merchant feed preflight covers one UTF-8 tab-delimited file and supported static rules only; conditional requirements, account state, policies, live pages, and submission outcomes remain outside scope.
- XML sitemap preflight covers one uncompressed UTF-8 XML file and supported static rules only; extensions, live responses, deployment state, Search Console, crawling, and indexing remain outside scope.

## License

MIT
