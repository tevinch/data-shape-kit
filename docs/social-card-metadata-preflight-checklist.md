# Social Card Metadata Preflight Checklist

Last verified: 2026-09-08

Use this checklist to review Open Graph metadata in one public HTML snapshot before an authorized site owner handles a release. This project is independent and is not endorsed by any social platform, WordPress provider, or hosting company. It does not access a website, account, server, content-management system, CDN, or hosting service.

## Current official guidance

The Open Graph protocol defines four required properties: `og:title`, `og:type`, `og:image`, and `og:url`. Metadata belongs in the document `head`. The protocol also defines optional properties such as `og:description`, structured image properties such as `og:image:width` and `og:image:height`, and `og:image:alt`; the latter should accompany an image. Repeated image properties form an ordered array, so distinct images are permitted.

- [Open Graph protocol](https://ogp.me/)

Standards and platform behavior change. Recheck the official page and the target platform's current documentation before release.

## Prepare an eligible file

- Use one UTF-8 HTML snapshot no larger than 10 MB.
- Put Open Graph meta tags inside `head` and include the four required properties.
- Use absolute public HTTP(S) URLs for `og:url` and `og:image`.
- Include `og:description` and a non-empty `og:image:alt` for the image set.
- Use an invented excerpt or content that is already public in a public issue.
- Real work accepts a public HTML snapshot only, supplied by the page owner or controller. Exclude private, staging, password-protected, personalized, regulated, confidential, personal, identity, credential-bearing, or unpublished pages.

## Run the local report

Install the immutable public version:

```bash
python -m pip install "data-shape-kit @ https://github.com/tevinch/data-shape-kit/archive/refs/tags/v0.18.0.tar.gz"
```

Run the preflight:

```bash
data-shape-kit --social-card-preflight page.html preflight.md
```

The report covers supported static findings, including:

- `missing_og_title`, `missing_og_type`, `missing_og_image`, and `missing_og_url`;
- empty required or description properties and `missing_og_description`;
- repeated singleton properties and `duplicate_og_image` for exact image repetitions;
- `invalid_og_url`, `invalid_og_image_url`, and `missing_og_image_alt`;
- `invalid_og_image_width`, `invalid_og_image_height`, and `og_metadata_outside_head`.

The report contains finding codes, counts, and meta-tag numbers only. It does not include source metadata values, make network requests, inspect an account, execute scripts, download images, or modify the input.

Static HTML cannot establish live-page markup, HTTP response behavior, redirect or cache state, image availability or content, rendered dimensions, framework output, platform-specific metadata precedence, or a platform's fetch history. It does not guarantee a preview, platform behavior, clicks, traffic, or sales.

## Fixed-price scopes

| Tier | File limit | Delivery |
| --- | --- | --- |
| **USD 25 Report** | One public HTML snapshot, up to 100 meta tags and 2 MB | Supported value-free findings report; no file changes. |
| **USD 75 Correct** | One eligible file, up to 250 meta tags and 5 MB | Report, one corrected HTML snapshot with agreed deterministic metadata corrections, change log, and second report. |
| **USD 150 Full** | One eligible file, up to 500 meta tags and 10 MB | Correct delivery, supported-findings review, and one in-scope revision. |

Open a [fixed-price social card metadata request](https://github.com/tevinch/data-shape-kit/issues/new?template=social-card-metadata-preflight-request.yml) with the tier, a synthetic or public excerpt, meta-tag count, size, deadline, and acceptance criteria.

No WordPress, social-platform, CDN, hosting, or server access, account login, live URL retrieval, script execution, image download or inspection, deployment, upload, cache refresh, platform validation, payment processing, infrastructure change, or security work is included. Scope, delivery, authorization, and a private file-transfer method are confirmed before any eligible file is shared.
