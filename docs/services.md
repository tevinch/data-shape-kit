# Optional file services

[Back to the tool directory](../README.md) · [Python command-line guide](python-cli.md)

The tools are free under the MIT license. The fixed scopes below are optional services for people who want help applying them. Each request starts with a scope check.

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

## Fixed-price robots.txt preflight

Need one public-site rules file checked before your team handles deployment? USD 25 Report covers up to 100 lines and 50 KiB, USD 75 Correct covers up to 1,000 lines and 250 KiB, and USD 150 Full covers one eligible file up to 500 KiB.

| Tier | File limit | Delivery |
| --- | --- | --- |
| **USD 25 Report** | One public website robots.txt file, up to 100 lines and 50 KiB | A value-free report covering supported syntax, groups, paths, sitemap locations, duplicates, conflicts, and wildcard crawl-block checks. No file changes. |
| **USD 75 Correct** | One eligible file, up to 1,000 lines and 250 KiB | The report, one corrected text file with agreed deterministic corrections, a change log, and a second report. |
| **USD 150 Full** | One eligible file, up to 500 KiB | The Correct delivery, a supported-findings review, and one in-scope revision. |

[Open a robots.txt preflight request](https://github.com/tevinch/data-shape-kit/issues/new?template=robots-txt-preflight-request.yml) with the tier, crawler groups, a small synthetic or already public excerpt, line count, size, deadline, and acceptance criteria. Real work accepts a public website robots.txt file only; no private, staging, regulated, confidential, personal, identity, credential, unpublished, or production data. No site, server, CMS, hosting, analytics, or Search Console access, account login, live URL retrieval, deployment, upload, submission, indexing request, infrastructure change, payment processing, or security work is included. The static check does not guarantee crawling or indexing, search visibility, ranking, traffic, or sales. Scope, delivery, and a private file-transfer method are confirmed before any real file is shared.

## Fixed-price podcast RSS preflight

Need one already-public podcast feed checked before your team handles a platform submission? USD 25 Report covers up to 100 episodes and 2 MB, USD 75 Correct covers up to 500 episodes and 5 MB, and USD 150 Full covers up to 2,000 episodes and 10 MB.

| Tier | File limit | Delivery |
| --- | --- | --- |
| **USD 25 Report** | One public podcast RSS snapshot, up to 100 episodes and 2 MB | A value-free report covering supported XML, RSS, channel, artwork, episode, enclosure, GUID, and date checks. No file changes. |
| **USD 75 Correct** | One eligible file, up to 500 episodes and 5 MB | The report, one corrected XML file with agreed deterministic corrections, a change log, and a second report. |
| **USD 150 Full** | One eligible file, up to 2,000 episodes and 10 MB | The Correct delivery, a supported-findings review, and one in-scope revision. |

[Open a podcast RSS preflight request](https://github.com/tevinch/data-shape-kit/issues/new?template=podcast-rss-preflight-request.yml) with the tier, a synthetic or already-public excerpt, episode count, size, deadline, and acceptance criteria. The requester must own or control the public feed. Private, paid-subscriber, password-protected, tokenized, personal, regulated, confidential, credential-bearing, or unpublished feeds are not accepted. No Apple Podcasts, Spotify, WordPress, hosting, or server access, account login, live URL retrieval, media download, artwork inspection, deployment, upload, submission, content review, payment processing, infrastructure change, or security work is included. The static check does not guarantee platform acceptance, listing, availability, playback, traffic, or sales. Scope, delivery, and a private file-transfer method are confirmed before any eligible file is shared.

## Fixed-price RSS and Atom feed preflight

Need one already-public web feed checked before your team handles publication or reader testing? USD 25 Report covers up to 250 entries and 2 MB, USD 75 Correct covers up to 2,500 entries and 5 MB, and USD 150 Full covers up to 10,000 entries and 10 MB.

| Tier | File limit | Delivery |
| --- | --- | --- |
| **USD 25 Report** | One public RSS 2.0 or Atom 1.0 snapshot, up to 250 entries and 2 MB | A value-free report covering supported XML, root, channel or feed, entry, author, link, date, and duplicate checks. No file changes. |
| **USD 75 Correct** | One eligible file, up to 2,500 entries and 5 MB | The report, one corrected XML file with agreed deterministic corrections using requester-supplied replacement values, a change log, and a second report. |
| **USD 150 Full** | One eligible file, up to 10,000 entries and 10 MB | The Correct delivery, a supported-findings review, and one in-scope revision. |

[Open an RSS and Atom feed preflight request](https://github.com/tevinch/data-shape-kit/issues/new?template=rss-atom-feed-preflight-request.yml) with the tier, format, a synthetic or already-public excerpt, entry count, size, deadline, and acceptance criteria. The requester must own or control the public feed. Contact-email fields and private, authenticated, tokenized, paid-subscriber, password-protected, personalized, regulated, confidential, personal, identity, credential-bearing, unpublished, or production feeds are refused. No feed reader, CMS, hosting, or server access, account login, live URL retrieval, import, subscription, publication, deployment, upload, content review, payment processing, infrastructure change, or security work is included. The static check does not guarantee HTTP behavior, MIME handling, or reader acceptance, publication, availability, traffic, or sales. Scope, delivery, authorization, supplied correction values, and a private file-transfer method are confirmed before any eligible file is shared.

## Fixed-price OPDS 2.0 catalog preflight

Need one already-public catalog snapshot checked before your team handles reader testing? USD 25 Report covers up to 250 publications and 2 MB, USD 75 Correct covers up to 2,500 publications and 5 MB, and USD 150 Full covers up to 10,000 publications and 10 MB.

| Tier | File limit | Delivery |
| --- | --- | --- |
| **USD 25 Report** | One public, authentication-free OPDS 2.0 JSON snapshot, up to 250 publications and 2 MB | A value-free report covering supported JSON, feed, link, collection, publication, acquisition, and image checks. No file changes. |
| **USD 75 Correct** | One eligible file, up to 2,500 publications and 5 MB | The report, one corrected JSON file using requester-supplied replacement values, a change log, and a second report. |
| **USD 150 Full** | One eligible file, up to 10,000 publications and 10 MB | The Correct delivery, a supported-findings review, and one in-scope revision. |

[Open an OPDS 2.0 catalog preflight request](https://github.com/tevinch/data-shape-kit/issues/new?template=opds-2-catalog-preflight-request.yml) with the tier, a synthetic or already-public excerpt, acquisition mode, publication count, size, deadline, and acceptance criteria. The requester must own or control the public catalog. Contact-email fields and paid, borrowed, subscribed, authenticated, DRM-protected, tokenized, personalized, private, restricted, confidential, personal, identity, credential-bearing, unpublished, or production catalogs are refused. No reader, catalog server, hosting, or account access, login, live URL retrieval, publication download, import, subscription, publication, deployment, upload, payment processing, infrastructure change, or security work is included. The static check does not guarantee HTTP behavior, MIME handling, or reader acceptance, availability, traffic, or sales. Scope, delivery, authorization, supplied correction values, and a private file-transfer method are confirmed before any eligible file is shared.

## Fixed-price social card metadata preflight

Need one already-public page snapshot checked before your team handles a release? USD 25 Report covers up to 100 meta tags and 2 MB, USD 75 Correct covers up to 250 meta tags and 5 MB, and USD 150 Full covers up to 500 meta tags and 10 MB.

| Tier | File limit | Delivery |
| --- | --- | --- |
| **USD 25 Report** | One public HTML snapshot, up to 100 meta tags and 2 MB | A value-free report covering supported required properties, values, URLs, duplicate images, image alternatives and dimensions, and placement. No file changes. |
| **USD 75 Correct** | One eligible file, up to 250 meta tags and 5 MB | The report, one corrected HTML snapshot with agreed deterministic metadata corrections, a change log, and a second report. |
| **USD 150 Full** | One eligible file, up to 500 meta tags and 10 MB | The Correct delivery, a supported-findings review, and one in-scope revision. |

[Open a social card metadata preflight request](https://github.com/tevinch/data-shape-kit/issues/new?template=social-card-metadata-preflight-request.yml) with the tier, a synthetic or already-public excerpt, meta-tag count, size, deadline, and acceptance criteria. The requester must own or control the public page. Private, staging, password-protected, personalized, regulated, confidential, personal, identity, credential-bearing, or unpublished pages are not accepted. No WordPress, social-platform, CDN, hosting, or server access, account login, live URL retrieval, script execution, image download or inspection, deployment, upload, cache refresh, platform validation, payment processing, infrastructure change, or security work is included. The static check does not guarantee a preview, platform behavior, clicks, traffic, or sales. Scope, delivery, authorization, and a private file-transfer method are confirmed before any eligible file is shared.

## Fixed-price JSON-LD preflight

Need JSON-LD in one already-public page snapshot checked before your team handles a release? USD 25 Report covers up to 25 JSON-LD scripts and 2 MB, USD 75 Correct covers up to 100 JSON-LD scripts and 5 MB, and USD 150 Full covers up to 250 JSON-LD scripts and 10 MB.

| Tier | File limit | Delivery |
| --- | --- | --- |
| **USD 25 Report** | One public HTML snapshot, up to 25 JSON-LD scripts and 2 MB | A value-free report covering supported script, JSON, top-level, context, type, ID, graph, duplicate-member, duplicate-block, and repeated-ID checks. No file changes. |
| **USD 75 Correct** | One eligible file, up to 100 JSON-LD scripts and 5 MB | The report, one corrected HTML snapshot with agreed deterministic JSON-LD corrections, a change log, and a second report. |
| **USD 150 Full** | One eligible file, up to 250 JSON-LD scripts and 10 MB | The Correct delivery, a supported-findings review, and one in-scope revision. |

[Open a JSON-LD preflight request](https://github.com/tevinch/data-shape-kit/issues/new?template=json-ld-preflight-request.yml) with the tier, a synthetic or already-public excerpt, script count, size, deadline, and acceptance criteria. The requester must own or control the public page. Private, staging, password-protected, personalized, regulated, confidential, personal, identity, credential-bearing, or unpublished pages are not accepted. No Search Console, WordPress, SEO-tool, hosting, or server access, account login, live URL retrieval, script execution, remote-context retrieval, deployment, upload, validation submission, payment processing, infrastructure change, or security work is included. The static check does not guarantee rich-result eligibility, appearance, ranking, traffic, or sales. Scope, delivery, authorization, and a private file-transfer method are confirmed before any eligible file is shared.

## Fixed-price public event calendar file preflight

Need one public event calendar file checked before your team handles distribution? USD 25 Report covers up to 250 events and 2 MB, USD 75 Correct covers up to 2,500 events and 5 MB, and USD 150 Full covers up to 10,000 events and 10 MB.

| Tier | File limit | Delivery |
| --- | --- | --- |
| **USD 25 Report** | One public event calendar file, up to 250 events and 2 MB | A value-free report covering supported line, component, required-property, date, span, and repeated-identifier checks. No file changes. |
| **USD 75 Correct** | One eligible file, up to 2,500 events and 5 MB | The report, one corrected iCalendar file with agreed deterministic corrections, a change log, and a second report. |
| **USD 150 Full** | One eligible file, up to 10,000 events and 10 MB | The Correct delivery, a supported-findings review, and one in-scope revision. |

[Open a public event calendar file preflight request](https://github.com/tevinch/data-shape-kit/issues/new?template=public-calendar-file-preflight-request.yml) with the tier, a synthetic or already-public excerpt, event count, size, deadline, and acceptance criteria. The requester must own or control the public event calendar. Files containing attendee, organizer, contact, meeting-request, private, confidential, regulated, personal, identity, credential-bearing, tokenized, or unpublished content are refused. No calendar account, Google Calendar, Outlook, WordPress, hosting, or server access, live URL retrieval, import, subscription, invitation sending, recurrence expansion, deployment, upload, payment processing, infrastructure change, or security work is included. The static check does not guarantee platform import, subscription refresh, interoperability, availability, traffic, or sales. Scope, delivery, authorization, and a private file-transfer method are confirmed before any eligible file is shared.
