"""Local CSV cleanup and aggregate reporting utilities."""

from .batch_preflight import BatchFinding, BatchPreflightReport, preflight_csv_batch
from .calendar_preflight import (
    CalendarFinding,
    CalendarPreflightReport,
    preflight_calendar,
)
from .clean import CleanReport, CsvShapeError, clean_csv, normalize_headers
from .compare import ComparisonFinding, CsvComparisonReport, compare_csvs
from .dictionary import ColumnDictionary, DictionaryReport, write_dictionary
from .ebay_preflight import EbayPreflightReport, preflight_ebay_csv
from .json_ld_preflight import (
    JsonLdFinding,
    JsonLdPreflightReport,
    preflight_json_ld,
)
from .merchant_feed_preflight import (
    MerchantFeedPreflightReport,
    MerchantFinding,
    preflight_merchant_feed,
)
from .opds_preflight import OpdsFinding, OpdsPreflightReport, preflight_opds
from .podcast_feed_preflight import (
    PodcastFeedPreflightReport,
    PodcastFinding,
    preflight_podcast_feed,
)
from .profile import ColumnProfile, ProfileReport, profile_csv
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
from .social_card_preflight import (
    SocialCardFinding,
    SocialCardPreflightReport,
    preflight_social_card,
)
from .woocommerce_preflight import (
    WooCommercePreflightReport,
    preflight_woocommerce_csv,
)

__all__ = [
    "BatchFinding",
    "BatchPreflightReport",
    "CalendarFinding",
    "CalendarPreflightReport",
    "CleanReport",
    "ColumnDictionary",
    "ColumnProfile",
    "ComparisonFinding",
    "CsvComparisonReport",
    "CsvShapeError",
    "DictionaryReport",
    "EbayPreflightReport",
    "Finding",
    "JsonLdFinding",
    "JsonLdPreflightReport",
    "MerchantFeedPreflightReport",
    "MerchantFinding",
    "OpdsFinding",
    "OpdsPreflightReport",
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
    "SocialCardFinding",
    "SocialCardPreflightReport",
    "WooCommercePreflightReport",
    "clean_csv",
    "compare_csvs",
    "normalize_headers",
    "preflight_calendar",
    "preflight_csv_batch",
    "preflight_ebay_csv",
    "preflight_json_ld",
    "preflight_merchant_feed",
    "preflight_opds",
    "preflight_podcast_feed",
    "preflight_redirect_map",
    "preflight_robots",
    "preflight_shopify_csv",
    "preflight_sitemap",
    "preflight_social_card",
    "preflight_woocommerce_csv",
    "profile_csv",
    "write_dictionary",
]
