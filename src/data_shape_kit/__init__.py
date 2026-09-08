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
from .podcast_feed_preflight import (
    PodcastFeedPreflightReport,
    PodcastFinding,
    preflight_podcast_feed,
)
from .redirect_preflight import (
    RedirectFinding,
    RedirectPreflightReport,
    preflight_redirect_map,
)
from .robots_preflight import RobotsFinding, RobotsPreflightReport, preflight_robots
from .shopify_preflight import Finding, ShopifyPreflightReport, preflight_shopify_csv
from .sitemap_preflight import (
    SitemapFinding,
    SitemapPreflightReport,
    preflight_sitemap,
)
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
    "PodcastFeedPreflightReport",
    "PodcastFinding",
    "ProfileReport",
    "RedirectFinding",
    "RedirectPreflightReport",
    "RobotsFinding",
    "RobotsPreflightReport",
    "ShopifyPreflightReport",
    "SitemapFinding",
    "SitemapPreflightReport",
    "WooCommercePreflightReport",
    "clean_csv",
    "compare_csvs",
    "normalize_headers",
    "profile_csv",
    "preflight_csv_batch",
    "preflight_redirect_map",
    "preflight_robots",
    "preflight_shopify_csv",
    "preflight_sitemap",
    "preflight_ebay_csv",
    "preflight_merchant_feed",
    "preflight_podcast_feed",
    "preflight_woocommerce_csv",
    "write_dictionary",
]
