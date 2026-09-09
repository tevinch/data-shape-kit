# Python command-line guide

[Back to the tool directory](../README.md) · [Optional service scopes](services.md)

A small Python command-line tool for deterministic CSV cleanup, privacy-preserving profile summaries, value-free Markdown data dictionaries, exact-key comparisons, batch structure checks, OPDS 2.0 catalog checks, RSS and Atom feed checks, public event calendar file checks, JSON-LD checks, social card metadata checks, podcast RSS checks, robots.txt checks, XML sitemap checks, tab-delimited product feed checks, redirect-map checks, and offline product import preflight reports. It normalizes headers, trims surrounding cell whitespace, removes exact duplicate rows, and reports aggregate checks locally.

## Requirements

- Python 3.11 or newer

## Install

For an editable local installation, download or clone this repository and run the following from its root directory:

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install --no-deps -e .
```

Install the verified public version directly from its fixed Git tag:

```bash
python -m pip install "data-shape-kit @ https://github.com/tevinch/data-shape-kit/archive/refs/tags/v0.18.0.tar.gz"
```

The tag keeps the installed source pinned to version 0.18.0. This method needs network access during installation but does not require Git; the installed tool itself has no runtime dependencies or network requests.

## Use

Example paths below are relative to the repository root. When using the installed package elsewhere, substitute your own input and output paths.

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

Use the [Shopify product CSV preflight checklist](shopify-product-csv-preflight-checklist.md) for a backup-first review sequence, finding explanations, and official references.

Run supported local checks on a WooCommerce product CSV before reviewing an import:

```bash
data-shape-kit --woocommerce-preflight products.csv preflight.md
```

The preflight checks the exact `Name` header, documented `Type` and `Published` values, repeated non-empty SKU values within the file, `Parent` on variation rows, and paired numbered attribute name/value columns. It writes only aggregate issue codes, severity, counts, and source row numbers; it does not include source cell values. An exit status of 1 means findings were reported. The result covers supported local checks only and does not guarantee import acceptance.

The checks follow WooCommerce's current [built-in product CSV schema](https://woocommerce.com/document/product-csv-importer-exporter/). Because the importer's mapping screen can map custom headers, a missing exact `Name` header is a warning rather than proof that an import will fail.

Use the [WooCommerce product CSV preflight checklist](woocommerce-product-csv-preflight-checklist.md) for a backup-first review sequence, finding explanations, and the official reference.

Run supported local checks on an eBay Seller Hub Reports listing or draft CSV before reviewing an upload:

```bash
data-shape-kit --ebay-preflight listings.csv preflight.md
```

The preflight preserves leading `#INFO` rows while locating the exact header row, then checks supported `Action`, `Category ID`, `Title`, `Start price`, `Quantity`, `Item photo URL`, `Condition ID`, `Description`, `Format`, `Duration`, `Schedule Time`, SKU, and `Relationship details` rules. It supports `Add` and `Draft` files; other action types are reported as outside the current check. The report contains only issue codes, severity, counts, and source row numbers, so it does not include source cell values. An exit status of 1 means findings were reported. The result covers supported local checks only and does not guarantee upload acceptance.

The checks follow eBay's current [Seller Hub Reports help](https://www.ebay.com/help/selling/selling-tools/seller-hub-reports?id=4096) and [inventory onboarding guide](https://pages.ebay.com/sh/reports/help/create-listings-bulk/). Category-specific item requirements, seller settings, business policies, fees, listing eligibility, and the upload results remain outside the local file check.

Use the [eBay listing file preflight checklist](ebay-listing-file-preflight-checklist.md) for a backup-first review sequence, finding explanations, and official references.

Compare two local CSV files with one exact, unique key:

```bash
data-shape-kit --compare-to current.csv --key "SKU" previous.csv comparison.md
```

The comparison reports added, removed, or reordered columns; missing and duplicate keys; rows found on only one side; changed row pairs; and the number of matched unchanged rows. It compares all exact common headers and does not modify either input. The Markdown report contains counts and old/new source row numbers only, so it does not include source cell values, header names, key values, or file names. Duplicate keys are reported as ambiguous and are not matched.

Use the [CSV comparison report checklist](csv-comparison-report-checklist.md) to confirm key stability, file safety, and the fixed report scope.

Run static checks on a site-migration redirect map:

```bash
data-shape-kit --redirect-preflight redirects.csv preflight.md
```

The CSV must use the exact `Source URL`, `Target URL`, and `Status Code` headers. The preflight checks absolute HTTP(S) URL shape, permanent 301/308 codes, duplicate or conflicting sources, self redirects, redirect chains and cycles, and targets shared by multiple sources. It writes issue codes, severity, counts, and source row numbers only, so it does not include source cell values. It does not make network requests, test deployed redirects, or judge whether two pages are meaningfully related, and it does not guarantee search performance.

The checks follow Google Search Central's current [site-move guidance](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes) and [redirect guidance](https://developers.google.com/search/docs/crawling-indexing/301-redirects).

Use the [redirect map preflight checklist](redirect-map-preflight-checklist.md) for a mapping-first review sequence, finding explanations, and scope boundaries.

Check the structure of every immediate CSV file in one local directory:

```bash
data-shape-kit --batch-preflight exports/ batch-report.md
```

The batch preflight reports the file and row totals, schema-group count, missing or invalid headers, UTF-8 failures, schema mismatches, and malformed rows. It uses stable file numbers and row locations only: the report does not include file names, header names, or source cell values. It does not read subdirectories and does not combine or modify files. An exit status of 1 means findings were reported.

Use the [CSV batch preflight checklist](csv-batch-preflight-checklist.md) for preparation, finding explanations, and fixed-scope service options.

Run supported static checks on a tab-delimited Merchant product feed:

```bash
data-shape-kit --merchant-feed-preflight products.tsv preflight.md
```

The file must be UTF-8 tab-delimited text. The check recognizes the exact core attributes `id`, `title` or `structured_title`, `description` or `structured_description`, `link`, `image_link`, `availability`, and `price`. It reports missing fields, duplicate IDs, malformed rows, supported availability and condition values, positive numeric price plus three-letter currency format, HTTP(S) URL shape, and the preorder date dependency. The report contains finding codes, counts, and source row numbers only, so it does not include source cell values. It does not make network requests, access an account, or modify the input, and it does not guarantee approval, eligibility, visibility, traffic, or sales.

The checks follow Google's current [product data specification](https://support.google.com/merchants/answer/7052112?hl=en), [tab-delimited file guidance](https://support.google.com/merchants/answer/14989239?hl=en), and [2026 specification update](https://support.google.com/merchants/answer/16989427?hl=en).

Use the [Merchant product feed preflight checklist](merchant-product-feed-preflight-checklist.md) for exact scope, current sources, and preparation steps.

Run supported static checks on one XML sitemap or sitemap index:

```bash
data-shape-kit --sitemap-preflight sitemap.xml preflight.md
```

The check covers UTF-8 XML up to 50 MB, the `urlset` or `sitemapindex` root and standard namespace, no more than 50,000 entries, one `loc` per entry, absolute HTTP(S) URL shape, duplicate locations, multiple origins, and supported `lastmod`, `changefreq`, and `priority` syntax. DTD and entity declarations are refused. The report contains finding codes, counts, and entry numbers only, so it does not include source URL values. It does not make network requests, access an account, or modify the input, and it does not guarantee crawling or indexing, search visibility, ranking, traffic, or sales.

The checks follow Google Search Central's current [sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap?hl=en) and the [Sitemaps protocol](https://www.sitemaps.org/protocol.html). Google ignores `priority` and `changefreq`; this command checks their protocol syntax only when they are present.

Use the [XML sitemap preflight checklist](xml-sitemap-preflight-checklist.md) for exact scope, finding explanations, and preparation steps.

Run supported static checks on one robots.txt file:

```bash
data-shape-kit --robots-preflight robots.txt preflight.md
```

The check covers UTF-8 text up to 500 KiB, supported `user-agent`, `allow`, `disallow`, and `sitemap` fields, group association, rule-path shape, absolute HTTP(S) sitemap locations, duplicate or conflicting rules, and a full-site crawl block for the wildcard group. The report contains finding codes, counts, and line numbers only, so it does not include source directive values. It does not make network requests, access an account, or modify the input, and it does not guarantee crawling or indexing, search visibility, ranking, traffic, or sales.

The checks follow Google's current [robots.txt specification](https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec), [creation guidance](https://developers.google.com/crawling/docs/robots-txt/create-robots-txt), and [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html). Fields outside the supported set are reported for review rather than interpreted.

Use the [robots.txt preflight checklist](robots-txt-preflight-checklist.md) for exact scope, finding explanations, and preparation steps.

Run supported static checks on one public podcast RSS file:

```bash
data-shape-kit --podcast-feed-preflight feed.xml preflight.md
```

The check covers UTF-8 XML up to 10 MB, an RSS 2.0 root with one channel, required channel title/link/description, show artwork, at least one episode, episode titles, one enclosure per episode, enclosure URL/length/type components, unique enclosure URLs, GUID presence and uniqueness, and RFC 2822 date syntax when a publication date is present. DTD and entity declarations are refused. The report contains finding codes, counts, and episode numbers only, so it does not include source feed values. It does not make network requests, access an account, download media, or modify the input, and it does not guarantee platform acceptance, listing, availability, playback, traffic, or sales.

The checks follow Apple's current [podcast RSS feed requirements](https://podcasters.apple.com/support/823-podcast-requirements) and the [RSS 2.0 specification](https://www.rssboard.org/rss-specification). Live-host behavior, artwork dimensions, media formats, and content review remain outside this local file check.

Use the [Podcast RSS preflight checklist](podcast-rss-preflight-checklist.md) for exact scope, finding explanations, and preparation steps.

Run supported static checks on one already-public RSS or Atom file:

```bash
data-shape-kit --feed-preflight feed.xml preflight.md
```

The check covers one UTF-8 XML snapshot up to 10 MB in RSS 2.0 and Atom 1.0. RSS checks cover the root, version, channel fields, item title-or-description, identifiers, public HTTP(S) links, supported dates, and duplicate GUIDs or links. Atom checks cover the required namespace, feed and entry IDs, titles, `updated` values, author inheritance, content or alternate links, and duplicate IDs or links. DTD and entity declarations are refused, as are files with contact-email fields or authenticated, tokenized, or private access markers. The report contains the feed type, finding codes, counts, and stable entry numbers only, so it does not include source feed values. It does not make network requests, access an account or CMS, import, subscribe, or modify the input, and it does not guarantee HTTP behavior, MIME handling, or reader acceptance, publication, availability, traffic, or sales.

The checks follow the [RSS 2.0 specification](https://www.rssboard.org/rss-specification) and [RFC 4287](https://www.rfc-editor.org/rfc/rfc4287.html). The [W3C Feed Validation Service documentation](https://validator.w3.org/feed/docs/) is a complementary reference; different validators and readers can apply additional rules.

Use the [RSS and Atom feed preflight checklist](rss-atom-feed-preflight-checklist.md) for exact scope, finding explanations, safety boundaries, and preparation steps.

Run supported static checks on one already-public, authentication-free OPDS 2.0 catalog snapshot:

```bash
data-shape-kit --opds-preflight catalog.json preflight.md
```

The check covers UTF-8 JSON up to 10 MB, strict JSON syntax and duplicate members, feed title and self link, navigation titles, group and facet shape, publication metadata, public download or preview links, and supported publication image types. Paid, borrowed, subscribed, authenticated, DRM-protected, tokenized, local, private, restricted, or contact-email-bearing catalogs are refused. The report contains only catalog type, collection and publication counts, finding codes, severity, counts, and stable locations, so it does not include source catalog values. It does not make network requests, authenticate, download publications, access a reader or catalog server, or modify the input, and it does not guarantee HTTP behavior, MIME handling, or reader acceptance.

The checks follow the current [OPDS 2.0 specification](https://specs.opds.io/opds-2.0) and its official feed and publication JSON Schemas. The local report is intentionally narrower than the complete specification and any reader-specific behavior.

Use the [OPDS 2.0 catalog preflight checklist](opds-2-catalog-preflight-checklist.md) for exact scope, finding explanations, safety boundaries, and preparation steps.

Run supported static checks on Open Graph metadata in one public HTML snapshot:

```bash
data-shape-kit --social-card-preflight page.html preflight.md
```

The check covers UTF-8 HTML up to 10 MB, the four required Open Graph properties, the recommended description and image alternative, public HTTP(S) URL shape, exact duplicate images, supported numeric image dimensions, and metadata placement inside `head`. The report contains finding codes, counts, and meta-tag numbers only, so it does not include source metadata values. It does not make network requests, access an account, execute scripts, download images, or modify the input, and it does not guarantee a preview, platform behavior, clicks, traffic, or sales.

The checks follow the current [Open Graph protocol](https://ogp.me/). Live-page markup, HTTP responses, caching, image content, framework output, and platform-specific interpretation remain outside this local snapshot check.

Use the [social card metadata preflight checklist](social-card-metadata-preflight-checklist.md) for exact scope, finding explanations, and preparation steps.

Run supported static checks on JSON-LD embedded in one public HTML snapshot:

```bash
data-shape-kit --json-ld-preflight page.html preflight.md
```

The check covers UTF-8 HTML up to 10 MB, JSON-LD script discovery, JSON syntax, top-level and `@graph` shape, duplicate JSON members, basic `@context`, `@type`, and `@id` shape, completely repeated blocks, and repeated identifiers for review. The report contains finding codes, counts, script numbers, and script.object locations only, so it does not include source JSON-LD values. It does not make network requests, access an account, execute scripts, or modify the input. It does not resolve remote contexts, compare visible page content, or validate schema.org vocabulary, Google feature-specific requirements, truthfulness, or policy compliance, and it does not guarantee rich-result eligibility, appearance, ranking, traffic, or sales.

The checks follow the current [W3C JSON-LD 1.1 Recommendation](https://www.w3.org/TR/json-ld11/) and use [Google's structured data introduction](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data) and [general guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) only to define important boundaries. Live rendering and Google-specific validation remain separate steps.

Use the [JSON-LD preflight checklist](json-ld-preflight-checklist.md) for exact scope, finding explanations, and preparation steps.

Run supported static checks on one public event calendar iCalendar file:

```bash
data-shape-kit --calendar-preflight events.ics preflight.md
```

The check covers UTF-8 iCalendar text up to 10 MB, CRLF line endings and folding, content-line shape, calendar and event component structure, required `PRODID`, `VERSION`, `UID`, `DTSTAMP`, and `DTSTART` properties, supported date and date-time syntax, conflicting end and duration fields, nonpositive event spans, and repeated event identifiers. The report contains finding codes, counts, and line numbers only, so it does not include source calendar values. Files containing attendee, organizer, contact, meeting-request, private, or confidential content are refused. It does not import or subscribe, make network requests, access a calendar account, send invitations, or modify the input, and it does not guarantee platform import, subscription refresh, interoperability, availability, traffic, or sales.

The checks follow [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545.html). [Google Calendar import troubleshooting](https://support.google.com/calendar/answer/45654?hl=en-uk&ref_topic=10510448) and [Microsoft's import-versus-subscribe guidance](https://support.microsoft.com/en-us/outlook/import-or-subscribe-to-a-calendar-in-outlook-com-or-outlook-on-the-web) help define platform boundaries; live import and subscription behavior remain separate steps.

Use the [public event calendar file preflight checklist](public-calendar-file-preflight-checklist.md) for exact scope, finding explanations, and preparation steps.

## Test

From the repository root:

```bash
PYTHONPATH=src python -m unittest discover -s tests -v
```

## Data privacy

Processing is local. The tool has no runtime dependencies, makes no network requests, and does not retain a copy of the input. Profile and dictionary modes hold distinct values only in process memory while counting. Preflight modes hold the values needed for supported within-file checks only in process memory. These reports do not include source cell or URL values. Normalized field names, source row numbers, and entry numbers are metadata and should still be treated as potentially sensitive.

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
- robots.txt preflight covers one UTF-8 text file and the documented static rules only; live retrieval, server state, Search Console, crawling, and indexing remain outside scope.
- Podcast RSS preflight covers one already-public UTF-8 XML snapshot and supported static rules only; hosting behavior, media availability, artwork properties, platform review, and submission outcomes remain outside scope.
- RSS and Atom feed preflight covers one already-public UTF-8 XML snapshot and supported RSS 2.0 or Atom 1.0 rules only; HTTP and MIME behavior, extension semantics, reader state, publication, import, subscriptions, and private or authenticated feed data remain outside scope.
- OPDS 2.0 catalog preflight covers one already-public, authentication-free UTF-8 JSON snapshot and supported static rules only; complete schema conformance, live HTTP and MIME behavior, reader state, publication downloads, transactions, subscriptions, and private or authenticated catalog data remain outside scope.
- Social card metadata preflight covers one already-public UTF-8 HTML snapshot and supported static Open Graph rules only; live markup, HTTP behavior, caches, rendered images, deployment state, and platform previews remain outside scope.
- JSON-LD preflight covers one already-public UTF-8 HTML snapshot and supported syntax and shape checks only; remote contexts, vocabulary, visible-content comparison, dynamic rendering, feature-specific requirements, policy, deployment state, and search appearance remain outside scope.
- Public event calendar file preflight covers one UTF-8 iCalendar snapshot containing public events only and supported static checks only; complete recurrence and time-zone semantics, MIME and HTTP behavior, calendar-account state, import, subscriptions, invitations, and private calendar data remain outside scope.

## License

[MIT](../LICENSE)
