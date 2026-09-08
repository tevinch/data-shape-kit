# Merchant Product Feed Preflight Checklist

Last verified: 2026-09-08

Use this checklist to review one tab-delimited product file before an authorized merchant handles submission. This project is independent and is not endorsed by Google. It does not access Merchant Center, Google Ads, a store, or a live product page.

## Current official guidance

Google's current documentation says that a file product source may use `.txt` or `.tsv`, that a text source must be tab-delimited, that the first line contains technical attribute names, and that every product occupies one line with the same delimiter count as the header. The product data specification also defines required core attributes, supported availability values, and price formatting. Google published its 2026 specification changes on April 14, 2026.

- [Product data specification](https://support.google.com/merchants/answer/7052112?hl=en)
- [Create a tab-delimited product data source](https://support.google.com/merchants/answer/14989239?hl=en)
- [Too many column delimiters](https://support.google.com/merchants/answer/160035?hl=en)
- [2026 product data specification update](https://support.google.com/merchants/answer/16989427?hl=en)

Requirements and platform behavior change. Recheck the official pages for the intended country, product category, condition, and destination before submission.

## Prepare an eligible file

- Use UTF-8 tab-delimited text with one product per line.
- Use exact English technical attribute names.
- Include `id`, `link`, `image_link`, `availability`, and `price`.
- Include exactly one of `title` or `structured_title`, and exactly one of `description` or `structured_description`.
- Share only a synthetic or fully redacted sample in a public issue.
- Real work accepts publicly available product catalog data only. Exclude private pricing, costs, margins, customer or order records, and all regulated, confidential, personal, financial, medical, education, identity, credential, unpublished, or production data.

## Run the local report

Install the immutable public version:

```bash
python -m pip install "data-shape-kit @ https://github.com/tevinch/data-shape-kit/archive/refs/tags/v0.11.0.tar.gz"
```

Run the preflight:

```bash
data-shape-kit --merchant-feed-preflight products.tsv preflight.md
```

The report covers supported static findings, including:

- `missing_id_header` and the other exact core-header checks;
- missing core values and `duplicate_id` rows;
- `malformed_row` when the delimiter count differs from the header;
- HTTP(S) shape for landing-page, image, and optional video links;
- supported availability and condition values;
- `missing_availability_date` for a preorder; and
- positive numeric price plus three-letter uppercase currency format.

The report contains finding codes, counts, and source row numbers only. It does not include source cell values, make network requests, inspect an account, retrieve pages, upload a file, or modify the input.

An exit status of 0 means no findings from the supported checks. An exit status of 1 means findings were written. An exit status of 2 means the file could not be read safely.

## Interpret conservatively

This preflight cannot evaluate conditional country or category requirements, policies, landing-page consistency, image quality, GTIN ownership, shipping settings, account state, fetch freshness, review status, or platform behavior. It does not guarantee approval, eligibility, visibility, traffic, or sales. Review Merchant Center's own issue details after an authorized person submits the file.

## Fixed-price scopes

| Tier | File limit | Delivery |
| --- | --- | --- |
| **USD 25 Report** | Up to 500 rows and 10 MB | Supported value-free findings report; no file changes. |
| **USD 75 Correct** | Up to 5,000 rows and 20 MB | Report, one corrected file with agreed deterministic corrections, change log, and second report. |
| **USD 150 Full** | Up to 50,000 rows and 50 MB | Correct delivery, supported-findings review, and one in-scope revision. |

Open a [fixed-price Merchant product feed request](https://github.com/tevinch/data-shape-kit/issues/new?template=merchant-product-feed-preflight-request.yml) with the tier, format, exact headers, a synthetic or fully redacted sample, size, rows, deadline, and acceptance criteria.

No Merchant Center, Google Ads, store, or production-system access, account login, API integration, website retrieval, submission, upload, policy appeal, payment processing, infrastructure change, or security work is included. Scope, delivery, and a private file-transfer method are confirmed before any eligible real file is shared.
