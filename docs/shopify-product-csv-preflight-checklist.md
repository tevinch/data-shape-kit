# Shopify Product CSV Preflight Checklist

Last verified: 2026-09-04

This guide is independent and is not endorsed by Shopify. It summarizes a small set of file-level checks from current Shopify Help Center guidance. It does not upload a file, access a store, or replace Shopify's import review.

## 1. Export a backup before editing

Export the current products before changing a file that will update existing records. Keep that export unchanged as a recovery reference. Shopify warns that sorting a product CSV can separate variants or images from their product and can lead to damaging overwrites, so preserve the original row order while you prepare an import. See Shopify's [product export guidance](https://help.shopify.com/en/manual/products/import-export/export-products).

Checklist:

- Keep an untouched export.
- Work on a copy with a distinct filename.
- Record whether the planned import creates products, updates products, or changes variants.
- Do not sort rows until you understand how every repeated handle groups a product, its variants, and its images.

## 2. Preserve UTF-8 and CSV quoting

Shopify requires UTF-8 for product CSV imports and exports. A spreadsheet editor can silently change encoding, delimiter, quoting, or line endings, so verify the saved file as CSV rather than relying on the spreadsheet view. Shopify's [common import issues](https://help.shopify.com/en/manual/products/import-export/common-import-issues) page describes encoding and quoting failures.

Checklist:

- Save as UTF-8 CSV.
- Keep commas inside a field quoted by the CSV writer.
- Check that every row has the same number of fields as the header.
- Reopen the saved file with a CSV-aware tool before treating it as final.

## 3. Keep exact headers

Shopify treats import headers as case-sensitive. The current format uses headers such as `Title`, `URL handle`, `Option1 name`, and `Option1 value`. Older exports can use names such as `Handle`, `Option1 Name`, and `Option1 Value`, and Shopify documents backward compatibility for older names. Do not mix header families accidentally. The current conditions for required columns and related fields are described in Shopify's [product CSV format guide](https://help.shopify.com/en/manual/products/import-export/using-csv).

Checklist:

- Confirm that `Title` has the exact expected capitalization.
- Identify whether the file uses current `URL handle` or legacy `Handle`.
- Compare every edited header against the template family you intend to use.
- Treat an unfamiliar column as a review item instead of guessing a replacement.

## 4. Keep each product's rows together

A product with variants or additional images can occupy multiple rows with the same non-empty handle. Keep those rows contiguous. If a handle appears, another product starts, and the first handle appears again later, review the sequence before importing.

Checklist:

- Scan repeated handles as ordered groups.
- Review any handle containing spaces or characters other than letters, numbers, and dashes.
- Do not assume that a repeated handle is a duplicate row; it can represent another variant or image.
- Preserve the relationship between the first product row and its following rows.

## 5. Keep variant dependencies together

Variant-related values can depend on option fields. Shopify notes that updating fields such as SKU or weight can require the corresponding Option1 name and value columns, and omitting dependent fields can change variant behavior. Review the exact dependency for the planned import in the [product CSV format guide](https://help.shopify.com/en/manual/products/import-export/using-csv) before deleting columns.

Checklist:

- When variant fields contain data, verify that the matching Option1 headers are present.
- Keep the capitalization consistent with the current or legacy header family.
- Review blank option values row by row.
- Treat any variant correction as a scoped change with an expected before/after result.

## 6. Run the local preflight

Install the fixed public version, then run the report locally:

```bash
python -m pip install "data-shape-kit @ https://github.com/tevinch/data-shape-kit/archive/refs/tags/v0.5.0.tar.gz"
data-shape-kit --shopify-preflight products.csv preflight.md
```

The report includes issue codes, severity, counts, and source row numbers. It does not include source cell values. An exit status of 0 means no findings from the supported checks, 1 means the report contains findings, and 2 means the file could not be parsed safely.

| Finding | What to review |
| --- | --- |
| `missing_title_header` | The exact `Title` header is absent. |
| `missing_handle_header` | Neither current `URL handle` nor legacy `Handle` is present. |
| `invalid_handle_format` | A non-empty handle has unsupported characters. |
| `non_contiguous_handle_group` | A handle resumes after another group has started. |
| `variant_fields_without_option1_headers` | Variant data is present without both matching Option1 headers. |

## Safe review request

Use only a synthetic or fully redacted sample in a public issue. Replace product titles, handles, SKUs, image URLs, vendors, tags, metafields, and other business data with invented values. State the intended import action, header family, permitted corrections, expected finding counts, and delivery date.

A [fixed-price Shopify product CSV preflight request](https://github.com/tevinch/data-shape-kit/issues/new?template=shopify-product-csv-preflight-request.yml) starts with a USD 25 report and also offers USD 75 correction and USD 150 full-review tiers. Limits range from 500 rows for the report to 50,000 rows for the full delivery. No store login, admin access, API credentials, production upload, actual import, or security work is included.

## What the check does not prove

The local check does not know store state, existing product and variant identifiers, import settings, market-specific columns, metafield definitions, remote image availability, or later Shopify behavior. It is not exhaustive and does not guarantee import acceptance. Review Shopify's [import workflow and error guidance](https://help.shopify.com/en/manual/products/import-export/import-products) and the preview shown by Shopify before choosing whether to import.

## Official references

- [Using CSV files to import and export products](https://help.shopify.com/en/manual/products/import-export/using-csv)
- [Importing products with a CSV file](https://help.shopify.com/en/manual/products/import-export/import-products)
- [Exporting products](https://help.shopify.com/en/manual/products/import-export/export-products)
- [Solutions to common product CSV import problems](https://help.shopify.com/en/manual/products/import-export/common-import-issues)
