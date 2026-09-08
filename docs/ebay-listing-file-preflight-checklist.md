# eBay Listing File Preflight Checklist

Last verified: 2026-09-08

This checklist is independent and is not endorsed by eBay. It summarizes a conservative set of file-level checks for Seller Hub Reports listing and draft CSV files. Review the current [Seller Hub Reports help](https://www.ebay.com/help/selling/selling-tools/seller-hub-reports?id=4096) and [inventory onboarding guide](https://pages.ebay.com/sh/reports/help/create-listings-bulk/) before relying on a file.

## 1. Keep the downloaded template and a backup

Download a current template for the intended eBay site, action, and categories. Keep the original file unchanged. Work on a copy and preserve leading `#INFO` rows because eBay identifies the template version, type, and site there.

## 2. Confirm the supported action

The local check supports create-listing rows with `Action` set to `Add` and create-draft rows with `Action` set to `Draft`. `Revise`, `Relist`, order, compatibility, and other feeds have different requirements and are reported as outside this check.

## 3. Review create-listing fields

For supported `Add` rows, review exact headers and required values for `Category ID`, `Title`, `Start price`, `Quantity`, `Item photo URL`, `Condition ID`, `Description`, `Format`, and `Duration`. The check validates only documented file shapes and value syntax. It cannot decide whether a category ID, condition, business policy, shipping choice, or item is eligible for a particular seller.

## 4. Review formats, schedules, and images

Use `Auction` or `FixedPrice` exactly in `Format`. Auction durations are checked against `1`, `3`, `5`, `7`, and `10`; fixed-price duration is checked against `GTC`. A non-empty `Schedule Time` is checked for `YYYY-MM-DD HH:MM:SS` syntax only. Image fields are checked for an HTTP or HTTPS URL, raw spaces, the documented cell length, and up to 12 pipe-separated URLs. URL reachability, dimensions, rights, and later availability are outside the report.

## 5. Review variation parent and child rows

A parent `Add` row precedes its `Variation` child rows. The parent's `Relationship details` declares traits and values; child rows select one value per trait and provide positive `Start price` and `Quantity` values. The check reports missing parents, spacing next to `=`, `|`, or `;`, undeclared child values, repeated non-empty SKUs, and parent rows that contain price or quantity values.

## 6. Run the local preflight

Install the fixed public version, then run the report locally:

```bash
python -m pip install "data-shape-kit @ https://github.com/tevinch/data-shape-kit/archive/refs/tags/v0.8.0.tar.gz"
data-shape-kit --ebay-preflight listings.csv preflight.md
```

The report includes issue codes, severity, counts, and source row numbers. It does not include source cell values. An exit status of 0 means no findings from the supported checks, 1 means the report contains findings, and 2 means the file could not be parsed safely.

| Finding | What to review |
| --- | --- |
| `missing_action_header` | The exact `Action` header is absent. |
| `missing_category_id_header` | The exact `Category ID` header is absent. |
| `missing_title_header` | The exact `Title` header is absent. |
| `unsupported_action` | A non-empty action is outside supported `Add` and `Draft` files. |
| `invalid_category_id` | An `Add` or `Draft` row lacks a 1-to-10 digit category ID. |
| `missing_title` / `title_too_long` | An `Add` title is empty or exceeds 80 characters. |
| `missing_start_price` / `invalid_start_price` | A required price is empty, non-numeric, too long, or not positive. |
| `missing_quantity` / `invalid_quantity` | A required quantity is empty or not a positive integer. |
| `missing_item_photo_url` / `invalid_item_photo_url` | A required image field is empty or fails supported URL syntax checks. |
| `invalid_condition_id` | An `Add` condition ID is empty or non-numeric; category validity is not checked. |
| `missing_description` | An `Add` description is empty. |
| `invalid_format` / `invalid_duration` | The listing format or its paired duration is outside the documented set. |
| `invalid_schedule_time` | A non-empty schedule value does not match the documented timestamp syntax. |
| `duplicate_sku` | A non-empty `Custom label (SKU)` repeats within this file. |
| `variation_without_parent` | A `Variation` row does not follow an active parent `Add` row. |
| `invalid_relationship_details_spacing` | A relationship detail has whitespace next to a separator. |
| `missing_relationship_details` / `variation_value_not_declared` | A variation definition is empty or a child does not match the parent's declared traits and values. |
| `variation_parent_with_price_or_quantity` | A detected variation parent contains a price or quantity that belongs on child rows. |

## Safe review request

Use only a synthetic or fully redacted sample in a public issue. Replace titles, descriptions, SKUs, image URLs, category details, locations, policy names, product identifiers, schedules, and other business data with invented values. State the downloaded template type, intended action, eBay site, permitted corrections, expected finding counts, and delivery date.

A [fixed-price eBay listing file preflight request](https://github.com/tevinch/data-shape-kit/issues/new?template=ebay-listing-file-preflight-request.yml) offers a USD 25 report, USD 75 correction, and USD 150 full-review tier. Limits range from 500 rows for the report to 50,000 rows for the full delivery. No seller account login, Seller Hub access, API credentials, production upload, actual listing action, image hosting, restricted-item review, or security work is included.

## What the check does not prove

The report does not know seller settings, category state, item-specific requirements, business policies, fees, limits, listing eligibility, URL reachability, or later eBay behavior. It is not exhaustive and does not guarantee upload acceptance. eBay instructs sellers to review the generated upload results because completed processing can still contain failed rows.

## Official references

- [Seller Hub Reports](https://www.ebay.com/help/selling/selling-tools/seller-hub-reports?id=4096)
- [Inventory onboarding guide](https://pages.ebay.com/sh/reports/help/create-listings-bulk/)
- [Uploadable templates](https://pages.ebay.com/sh/reports/help/uploadable-file-feeds/)
- [Multi-quantity listings and variations](https://www.ebay.com/help/selling/listings/creating-managing-listings/creating-listings-variations?id=4150)
