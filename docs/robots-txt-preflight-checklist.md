# robots.txt Preflight Checklist

Last verified: 2026-09-08

Use this checklist to review one public website robots.txt file before an authorized site owner handles deployment. This project is independent and is not endorsed by Google. It does not access a website, server, CMS, hosting account, analytics, or Search Console.

## Current official guidance

Google's current documentation says the file belongs at the site root, should be UTF-8 text, and must remain at or below 500 KiB for Google's complete parsing. Google documents `user-agent`, `allow`, `disallow`, and `sitemap` as supported fields. Its parser combines groups that name the same crawler, ignores unsupported fields such as `crawl-delay`, and treats an empty file as allowing crawling. RFC 9309 defines the Robots Exclusion Protocol syntax and matching model.

- [Google robots.txt specification](https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec)
- [Create and submit a robots.txt file](https://developers.google.com/crawling/docs/robots-txt/create-robots-txt)
- [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html)

Requirements and crawler behavior change. Recheck the official pages before deployment.

## Prepare an eligible file

- Use one UTF-8 text file no larger than 500 KiB.
- Keep every `allow` or `disallow` rule inside a valid `user-agent` group.
- Begin non-empty rule paths with `/` and use absolute HTTP(S) locations for `sitemap` fields.
- Use an invented excerpt or content that is already public in a public issue.
- Real work accepts a public website robots.txt file only. Exclude private, staging, regulated, confidential, personal, identity, credential, unpublished, or production data.

## Run the local report

Install the immutable public version:

```bash
python -m pip install "data-shape-kit @ https://github.com/tevinch/data-shape-kit/archive/refs/tags/v0.15.0.tar.gz"
```

Run the preflight:

```bash
data-shape-kit --robots-preflight robots.txt preflight.md
```

The report covers supported static findings, including:

- `invalid_line`, `invalid_user_agent`, and `rule_without_user_agent`;
- `invalid_rule_path`, `invalid_sitemap`, and `unsupported_field`;
- `duplicate_rule`, `conflicting_rule`, and `duplicate_sitemap`; and
- `global_crawl_block` for a wildcard group that disallows `/` without allowing `/`.

The report contains finding codes, counts, and line numbers only. It does not include source directive values, make network requests, inspect an account, or modify the input.

Static syntax cannot establish a live file's availability, HTTP status, content type, redirect behavior, cache state, crawler interpretation outside the documented rules, or site ownership. It does not guarantee crawling or indexing, search visibility, ranking, traffic, or sales.

## Fixed-price scopes

| Tier | File limit | Delivery |
| --- | --- | --- |
| **USD 25 Report** | One public website robots.txt file, up to 100 lines and 50 KiB | Supported value-free findings report; no file changes. |
| **USD 75 Correct** | One eligible file, up to 1,000 lines and 250 KiB | Report, one corrected text file with agreed deterministic corrections, change log, and second report. |
| **USD 150 Full** | One eligible file, up to 500 KiB | Correct delivery, supported-findings review, and one in-scope revision. |

Open a [fixed-price robots.txt request](https://github.com/tevinch/data-shape-kit/issues/new?template=robots-txt-preflight-request.yml) with the tier, crawler groups, a synthetic or public excerpt, line count, size, deadline, and acceptance criteria.

No site, server, CMS, hosting, analytics, or Search Console access, account login, live URL retrieval, deployment, upload, submission, indexing request, infrastructure change, payment processing, or security work is included. Scope, delivery, and a private file-transfer method are confirmed before any eligible real file is shared.
