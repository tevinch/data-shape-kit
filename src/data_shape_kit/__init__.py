"""Local CSV cleanup and aggregate reporting utilities."""

from .batch_preflight import BatchFinding, BatchPreflightReport, preflight_csv_batch
from .clean import CleanReport, CsvShapeError, clean_csv, normalize_headers
from .compare import ComparisonFinding, CsvComparisonReport, compare_csvs
from .dictionary import ColumnDictionary, DictionaryReport, write_dictionary
from .ebay_preflight import EbayPreflightReport, preflight_ebay_csv
from .merchant_feed_preflight import (
    MerchantFeedPreflightReport,
    MerchantFinding,
    preflight_merchant_feed,
)
from .profile import ColumnProfile, ProfileReport, profile_csv
from .redirect_preflight import (
    RedirectFinding,
    RedirectPreflightReport,
    preflight_redirect_map,
)
from .shopify_preflight import Finding, ShopifyPreflightReport, preflight_shopify_csv
from .woocommerce_preflight import (
    WooCommercePreflightReport,
    preflight_woocommerce_csv,
)

__all__ = [
    "CleanReport",
    "BatchFinding",
    "BatchPreflightReport",
    "ComparisonFinding",
    "ColumnProfile",
    "ColumnDictionary",
    "CsvShapeError",
    "CsvComparisonReport",
    "DictionaryReport",
    "EbayPreflightReport",
    "Finding",
    "MerchantFeedPreflightReport",
    "MerchantFinding",
    "ProfileReport",
    "RedirectFinding",
    "RedirectPreflightReport",
    "ShopifyPreflightReport",
    "WooCommercePreflightReport",
    "clean_csv",
    "compare_csvs",
    "normalize_headers",
    "profile_csv",
    "preflight_csv_batch",
    "preflight_redirect_map",
    "preflight_shopify_csv",
    "preflight_ebay_csv",
    "preflight_merchant_feed",
    "preflight_woocommerce_csv",
    "write_dictionary",
]
