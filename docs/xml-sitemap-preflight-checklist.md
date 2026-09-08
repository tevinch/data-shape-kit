# XML Sitemap Preflight Checklist

Last verified: 2026-09-08

Use this checklist to review one public website sitemap or sitemap index before an authorized site owner handles deployment or submission. This project is independent and is not endorsed by Google. It does not access a website, server, CMS, hosting account, analytics, or Search Console.

## Current official guidance

Google's current documentation says a sitemap must use UTF-8, contain fully qualified absolute URLs, and remain at or below 50 MB uncompressed and 50,000 URLs. The Sitemaps protocol defines the `urlset` and `sitemapindex` roots, the standard namespace, required `loc` elements, single-site guidance, and optional `lastmod`, `changefreq`, and `priority` values. Google says it ignores `changefreq` and `priority`; this preflight checks their protocol syntax only when they are present.

- [Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap?hl=en)
- [Sitemaps protocol](https://www.sitemaps.org/protocol.html)

Requirements and search-engine behavior change. Recheck the official pages before deployment or submission.

## Prepare an eligible file

- Use one uncompressed UTF-8 XML file no larger than 50 MB.
- Use either a `urlset` containing `url` entries or a `sitemapindex` containing `sitemap` entries.
- Use the standard `http://www.sitemaps.org/schemas/sitemap/0.9` namespace.
- Keep no more than 50,000 entries and include exactly one `loc` in each entry.
- Share only a synthetic excerpt or already public URLs in a public issue.
- Real work accepts a public website sitemap only. Exclude private, staging, regulated, confidential, personal, identity, credential, unpublished, or production data.

## Run the local report

Install the immutable public version:

```bash
python -m pip install "data-shape-kit @ https://github.com/tevinch/data-shape-kit/archive/refs/tags/v0.11.0.tar.gz"
```

Run the preflight:

```bash
data-shape-kit --sitemap-preflight sitemap.xml preflight.md
```

The report covers supported static findings, including:

- `invalid_root`, `invalid_namespace`, and `invalid_entry_namespace`;
- `empty_sitemap` and `too_many_entries`;
- `missing_loc`, `multiple_loc`, `invalid_loc`, and `duplicate_loc`;
- `multiple_origins`, which is a conservative warning because authorized cross-site cases can exist;
- `multiple_lastmod` and `invalid_lastmod`; and
- optional `changefreq` and `priority` multiplicity or syntax findings.

DTD and entity declarations are refused before XML parsing. The report contains finding codes, counts, and entry numbers only. It does not include source URL values, make network requests, inspect an account, retrieve any listed URL, deploy or submit the file, or modify the input.

An exit status of 0 means no findings from the supported checks. An exit status of 1 means findings were written. An exit status of 2 means the file could not be read safely.

## Interpret conservatively

This preflight cannot evaluate HTTP status, content type, redirects, response headers, caching, CDN behavior, robots rules, canonical choices, page quality, extension semantics, site ownership, Search Console state, deployment, submission, crawling, or indexing. It does not guarantee crawling or indexing, search visibility, ranking, traffic, or sales.

## Fixed-price scopes

| Tier | File limit | Delivery |
| --- | --- | --- |
| **USD 25 Report** | One public-site XML sitemap or index, up to 5,000 entries and 10 MB | Supported value-free findings report; no file changes. |
| **USD 75 Correct** | One eligible file, up to 25,000 entries and 25 MB | Report, one corrected XML file with agreed deterministic corrections, change log, and second report. |
| **USD 150 Full** | One eligible file, up to 50,000 entries and 50 MB | Correct delivery, supported-findings review, and one in-scope revision. |

Open a [fixed-price XML sitemap request](https://github.com/tevinch/data-shape-kit/issues/new?template=xml-sitemap-preflight-request.yml) with the tier, root kind, a synthetic or public excerpt, entry count, size, deadline, and acceptance criteria.

No site, server, CMS, hosting, analytics, or Search Console access, account login, live URL retrieval, deployment, submission, upload, indexing request, infrastructure change, payment processing, or security work is included. Scope, delivery, and a private file-transfer method are confirmed before any eligible real file is shared.
