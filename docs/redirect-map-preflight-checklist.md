# Redirect Map Preflight Checklist

Last verified: 2026-09-08

Use this checklist to review a website-migration URL mapping before a qualified site owner or administrator configures permanent redirects. The preflight is an independent static file check. It does not access a website or determine whether pages have equivalent content.

## Current guidance

Google Search Central recommends preparing an accurate old-to-new URL mapping before a move, using server-side permanent redirects where possible, sending each old URL directly to its final destination, and avoiding irrelevant redirects such as sending many unrelated pages to a new homepage:

- [Site moves with URL changes](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes)
- [Redirects and Google Search](https://developers.google.com/search/docs/crawling-indexing/301-redirects)

The guidance and platform behavior can change. Recheck the linked official pages before a migration.

## Prepare the map

Create a UTF-8 CSV with these exact headers:

```csv
Source URL,Target URL,Status Code
https://old.example/page,https://new.example/page,301
```

Use absolute HTTP(S) URLs. Each source should occur once and point directly to its final destination. The supported status codes are `301` and `308` because this scope covers permanent moves.

For a public request, share only a synthetic or publicly known URL sample. A real file must contain publicly known URLs only; private or staging URLs and regulated, confidential, personal, financial, medical, education, identity, credential, or production data are outside scope.

## Run the local report

Install the immutable public version:

```bash
python -m pip install "data-shape-kit @ https://github.com/tevinch/data-shape-kit/archive/refs/tags/v0.11.0.tar.gz"
```

Run the preflight:

```bash
data-shape-kit --redirect-preflight redirects.csv preflight.md
```

The report checks:

- missing exact headers and missing row values;
- malformed, non-HTTP(S), credential-bearing, fragmented, or overly long URL values;
- status codes other than 301 or 308;
- identical duplicate sources and conflicting sources;
- self redirects, redirect chains and cycles; and
- targets shared by multiple distinct sources, which require a relevance review.

The report contains only issue codes, severity, counts, and source row numbers. It does not include source cell values. It does not make network requests, change the input, deploy redirects, or inspect content.

An exit status of 0 means no findings from the supported static checks. An exit status of 1 means findings were written. An exit status of 2 means the file could not be read safely.

## Interpret conservatively

- A shared target may be a legitimate content consolidation; the preflight only flags it for human review.
- A syntactically valid target may still be missing, blocked, irrelevant, or configured with the wrong live status.
- The preflight cannot check server configuration, live responses, page equivalence, canonical tags, robots rules, sitemaps, analytics, or Search Console.
- Passing the static checks does not guarantee indexing, rankings, traffic, or any other search outcome. This service does not guarantee search performance.

## Fixed-price scopes

| Tier | File limit | Delivery |
| --- | --- | --- |
| **USD 25 Report** | Up to 500 mappings and 10 MB | Supported static findings report; no file changes. |
| **USD 75 Correct** | Up to 5,000 mappings and 10 MB | Report, one corrected map with agreed deterministic corrections, change log, and second report. |
| **USD 150 Full** | Up to 50,000 mappings and 25 MB | Correct delivery, supported-findings review, and one in-scope revision. |

Open a [fixed-price redirect map preflight request](https://github.com/tevinch/data-shape-kit/issues/new?template=redirect-map-preflight-request.yml) with the tier, exact headers, intended permanent redirects, a synthetic or publicly known URL sample, deadline, and acceptance criteria.

No site, server, CMS, analytics, or Search Console access, live crawl, redirect deployment, infrastructure change, payment processing, or security work is included. Scope, delivery, and a private file-transfer method are confirmed before any real file is shared.
