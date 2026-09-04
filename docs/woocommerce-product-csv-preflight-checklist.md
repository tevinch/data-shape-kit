# WooCommerce Product CSV Preflight Checklist

Last verified: 2026-09-04

This checklist is independent and is not endorsed by WooCommerce. It summarizes a small set of file-level checks for the built-in product CSV importer. Review the current [WooCommerce Product CSV Importer and Exporter documentation](https://woocommerce.com/document/product-csv-importer-exporter/) before relying on a CSV.

## 1. Export a backup before editing

Export the relevant products and keep that file unchanged. Record whether the next import will create products, update products, or add variations. An offline report cannot reconstruct store state or undo an import.

## 2. Preserve UTF-8 and CSV structure

Save the file as UTF-8 CSV, keep commas inside fields quoted, and verify that every row has the same number of fields as the header. Reopen the saved file with a CSV-aware tool before treating it as final.

## 3. Review headers and mapping

The built-in importer recognizes schema headers such as `Name`, `Type`, `SKU`, `Published`, and `Parent`, while its mapping screen can map other headers. Decide which exact headers you expect before changing names. A missing exact `Name` header is therefore a warning, not proof that the import must fail.

## 4. Check documented values

Review non-empty `Type` tokens against the documented product types. Review `Published` values against `1`, `0`, `-1`, `2`, `true`, and `false`. The local check reports unsupported values by source row number without copying the values into the report.

## 5. Check identifiers, variations, and attributes

Review repeated non-empty SKU values within the file. A variation row should identify a parent through the `Parent` field. For each numbered attribute, keep its `Attribute N name` and `Attribute N value(s)` columns paired. Store-wide SKU conflicts and extension-specific fields remain outside the file-level check.

## 6. Run the local preflight

Install the fixed public version, then run the report locally:

```bash
python -m pip install "data-shape-kit @ https://github.com/tevinch/data-shape-kit/archive/refs/tags/v0.5.0.tar.gz"
data-shape-kit --woocommerce-preflight products.csv preflight.md
```

The report includes issue codes, severity, counts, and source row numbers. It does not include source cell values. An exit status of 0 means no findings from the supported checks, 1 means the report contains findings, and 2 means the file could not be parsed safely.

| Finding | What to review |
| --- | --- |
| `missing_name_header` | The exact `Name` header is absent; confirm the intended manual mapping. |
| `invalid_type` | A non-empty type token is outside the documented built-in set. |
| `invalid_published_value` | A non-empty publication value is outside the documented set. |
| `duplicate_sku` | A non-empty SKU repeats within this file. |
| `variation_without_parent` | A variation row has no non-empty `Parent`. |
| `attribute_columns_not_paired` | A numbered attribute name/value column has data without its paired column. |

## Safe review request

Use only a synthetic or fully redacted sample in a public issue. Replace names, SKUs, descriptions, URLs, categories, tags, attributes, metadata, and other business data with invented values. State the intended import action, mapping assumptions, permitted corrections, expected finding counts, and delivery date.

A [fixed-price WooCommerce product CSV preflight request](https://github.com/tevinch/data-shape-kit/issues/new?template=woocommerce-product-csv-preflight-request.yml) offers a USD 25 report, USD 75 correction, and USD 150 full-review tier. Limits range from 500 rows for the report to 50,000 rows for the full delivery. No store login, WordPress access, plugin installation, admin access, API credentials, production upload, actual import, or security work is included.

## What the check does not prove

The local check does not know store state, existing products and SKUs, import mappings, installed extensions, custom metadata, remote file availability, or later WooCommerce behavior. It is not exhaustive and does not guarantee import acceptance. Review the mapping and preview shown by WooCommerce before choosing whether to import.

## Official reference

- [WooCommerce Product CSV Importer and Exporter](https://woocommerce.com/document/product-csv-importer-exporter/)
