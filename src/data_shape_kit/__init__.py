"""Local CSV cleanup and aggregate reporting utilities."""

from .clean import CleanReport, CsvShapeError, clean_csv, normalize_headers
from .dictionary import ColumnDictionary, DictionaryReport, write_dictionary
from .profile import ColumnProfile, ProfileReport, profile_csv
from .shopify_preflight import Finding, ShopifyPreflightReport, preflight_shopify_csv
from .woocommerce_preflight import (
    WooCommercePreflightReport,
    preflight_woocommerce_csv,
)

__all__ = [
    "CleanReport",
    "ColumnProfile",
    "ColumnDictionary",
    "CsvShapeError",
    "DictionaryReport",
    "Finding",
    "ProfileReport",
    "ShopifyPreflightReport",
    "WooCommercePreflightReport",
    "clean_csv",
    "normalize_headers",
    "profile_csv",
    "preflight_shopify_csv",
    "preflight_woocommerce_csv",
    "write_dictionary",
]
