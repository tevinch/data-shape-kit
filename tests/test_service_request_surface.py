import json
import subprocess
import unittest
from pathlib import Path


class RepositorySurfaceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(__file__).resolve().parents[1]

    def test_readme_exposes_bounded_cleanup_request(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")

        self.assertIn("## Fixed-price CSV cleanup", readme)
        self.assertIn("USD 25", readme)
        self.assertIn("one UTF-8 CSV up to 10 MB", readme)
        self.assertIn(
            "issues/new?template=csv-cleanup-request.yml",
            readme,
        )
        self.assertIn("Do not attach confidential, personal, or production data", readme)

    def test_issue_form_collects_safe_acceptance_inputs(self) -> None:
        form_path = (
            self.root / ".github" / "ISSUE_TEMPLATE" / "csv-cleanup-request.yml"
        )
        self.assertTrue(form_path.is_file(), "CSV cleanup issue form is missing")
        form = form_path.read_text(encoding="utf-8")

        for field_id in (
            "summary",
            "sample",
            "cleanup",
            "acceptance",
            "size",
            "deadline",
            "data-safety",
            "scope",
        ):
            with self.subTest(field_id=field_id):
                self.assertIn(f"id: {field_id}", form)
        self.assertIn("USD 25", form)
        self.assertIn("no confidential, personal, or production data", form)

    def test_readme_exposes_bounded_transformation_request(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")

        self.assertIn("## Fixed-price CSV transformation", readme)
        self.assertIn("USD 50", readme)
        self.assertIn("up to five deterministic column rules", readme)
        self.assertIn("standalone Python script and test suite", readme)
        self.assertIn(
            "issues/new?template=csv-transformation-request.yml",
            readme,
        )
        self.assertIn("No account access", readme)

    def test_transformation_form_collects_bounded_safe_inputs(self) -> None:
        form_path = (
            self.root
            / ".github"
            / "ISSUE_TEMPLATE"
            / "csv-transformation-request.yml"
        )
        self.assertTrue(form_path.is_file(), "CSV transformation form is missing")
        form = form_path.read_text(encoding="utf-8")

        for field_id in (
            "summary",
            "sample",
            "rules",
            "acceptance",
            "columns",
            "size",
            "deadline",
            "data-safety",
            "scope",
        ):
            with self.subTest(field_id=field_id):
                self.assertIn(f"id: {field_id}", form)
        self.assertIn("USD 50", form)
        self.assertIn("up to five deterministic column rules", form)
        self.assertIn("no confidential, personal, or production data", form)
        self.assertIn("No account access", form)

    def test_readme_exposes_bounded_validation_request(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")

        self.assertIn("## Fixed-price CSV validation", readme)
        self.assertIn("USD 75", readme)
        self.assertIn("up to five reproducible validation rules", readme)
        self.assertIn("read-only Python command and test suite", readme)
        self.assertIn(
            "issues/new?template=csv-validation-request.yml",
            readme,
        )
        self.assertIn("does not modify your input", readme)

    def test_validation_form_collects_bounded_safe_inputs(self) -> None:
        form_path = (
            self.root / ".github" / "ISSUE_TEMPLATE" / "csv-validation-request.yml"
        )
        self.assertTrue(form_path.is_file(), "CSV validation form is missing")
        form = form_path.read_text(encoding="utf-8")

        for field_id in (
            "summary",
            "sample",
            "rules",
            "columns",
            "report",
            "acceptance",
            "size",
            "deadline",
            "data-safety",
            "scope",
        ):
            with self.subTest(field_id=field_id):
                self.assertIn(f"id: {field_id}", form)
        self.assertIn("USD 75", form)
        self.assertIn("up to five reproducible validation rules", form)
        self.assertIn("no confidential, personal, or production data", form)
        self.assertIn("does not modify the input", form)

    def test_readme_exposes_bounded_reporting_pipeline_request(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")

        self.assertIn("## Fixed-price CSV reporting pipeline", readme)
        self.assertIn("USD 100", readme)
        self.assertIn("up to five deterministic field rules", readme)
        self.assertIn("up to three CSV outputs", readme)
        self.assertIn(
            "issues/new?template=csv-reporting-pipeline-request.yml",
            readme,
        )
        self.assertIn("one grouping key", readme)

    def test_reporting_pipeline_form_collects_bounded_safe_inputs(self) -> None:
        form_path = (
            self.root
            / ".github"
            / "ISSUE_TEMPLATE"
            / "csv-reporting-pipeline-request.yml"
        )
        self.assertTrue(form_path.is_file(), "CSV reporting pipeline form is missing")
        form = form_path.read_text(encoding="utf-8")

        for field_id in (
            "summary",
            "sample",
            "rules",
            "grouping",
            "outputs",
            "acceptance",
            "size",
            "deadline",
            "data-safety",
            "scope",
        ):
            with self.subTest(field_id=field_id):
                self.assertIn(f"id: {field_id}", form)
        self.assertIn("USD 100", form)
        self.assertIn("up to five deterministic field rules", form)
        self.assertIn("up to three CSV outputs", form)
        self.assertIn("no confidential, personal, or production data", form)
        self.assertIn("No account access", form)

    def test_readme_exposes_bounded_data_dictionary_request(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")

        self.assertIn("## Fixed-price CSV data dictionary", readme)
        self.assertIn("USD 125", readme)
        self.assertIn("up to 100 columns", readme)
        self.assertIn("Markdown data dictionary", readme)
        self.assertIn("machine-readable field specification", readme)
        self.assertIn("import readiness checklist", readme)
        self.assertIn(
            "issues/new?template=csv-data-dictionary-request.yml",
            readme,
        )
        self.assertIn("No account access", readme)

    def test_data_dictionary_form_collects_bounded_safe_inputs(self) -> None:
        form_path = (
            self.root
            / ".github"
            / "ISSUE_TEMPLATE"
            / "csv-data-dictionary-request.yml"
        )
        self.assertTrue(form_path.is_file(), "CSV data dictionary form is missing")
        form = form_path.read_text(encoding="utf-8")

        for field_id in (
            "summary",
            "sample",
            "columns",
            "definitions",
            "types",
            "required",
            "acceptance",
            "size",
            "deadline",
            "data-safety",
            "scope",
        ):
            with self.subTest(field_id=field_id):
                self.assertIn(f"id: {field_id}", form)
        self.assertIn("USD 125", form)
        self.assertIn("up to 100 columns", form)
        self.assertIn("no confidential, personal, or production data", form)
        self.assertIn("No account access", form)

    def test_readme_exposes_bounded_shopify_preflight_request(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")

        self.assertIn("## Fixed-price Shopify product CSV preflight", readme)
        self.assertIn("USD 25 Report", readme)
        self.assertIn("up to 500 rows", readme)
        self.assertIn("USD 75 Correct", readme)
        self.assertIn("up to 5,000 rows", readme)
        self.assertIn("USD 150 Full", readme)
        self.assertIn("USD 150", readme)
        self.assertIn("up to 50,000 rows", readme)
        self.assertIn("one corrected product CSV", readme)
        self.assertIn("change log", readme)
        self.assertIn(
            "issues/new?template=shopify-product-csv-preflight-request.yml",
            readme,
        )
        self.assertIn("does not guarantee import acceptance", readme)
        self.assertIn("No store login", readme)

    def test_shopify_preflight_form_collects_bounded_safe_inputs(self) -> None:
        form_path = (
            self.root
            / ".github"
            / "ISSUE_TEMPLATE"
            / "shopify-product-csv-preflight-request.yml"
        )
        self.assertTrue(form_path.is_file(), "Shopify preflight form is missing")
        form = form_path.read_text(encoding="utf-8")

        for field_id in (
            "tier",
            "summary",
            "sample",
            "action",
            "headers",
            "acceptance",
            "size",
            "rows",
            "deadline",
            "data-safety",
            "scope",
        ):
            with self.subTest(field_id=field_id):
                self.assertIn(f"id: {field_id}", form)
        self.assertIn("USD 25 Report", form)
        self.assertIn("USD 75 Correct", form)
        self.assertIn("USD 150 Full", form)
        self.assertIn("USD 150", form)
        self.assertIn("up to 50,000 rows", form)
        self.assertIn("no confidential, personal, or production data", form)
        self.assertIn("No store login", form)
        self.assertIn("does not guarantee import acceptance", form)

    def test_readme_exposes_bounded_woocommerce_preflight_request(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")

        self.assertIn("## Fixed-price WooCommerce product CSV preflight", readme)
        self.assertIn("USD 25 Report", readme)
        self.assertIn("up to 500 rows", readme)
        self.assertIn("USD 75 Correct", readme)
        self.assertIn("up to 5,000 rows", readme)
        self.assertIn("USD 150 Full", readme)
        self.assertIn("up to 50,000 rows", readme)
        self.assertIn(
            "issues/new?template=woocommerce-product-csv-preflight-request.yml",
            readme,
        )
        self.assertIn("does not guarantee import acceptance", readme)
        self.assertIn("No store login", readme)

    def test_woocommerce_preflight_form_collects_bounded_safe_inputs(self) -> None:
        form_path = (
            self.root
            / ".github"
            / "ISSUE_TEMPLATE"
            / "woocommerce-product-csv-preflight-request.yml"
        )
        self.assertTrue(form_path.is_file(), "WooCommerce preflight form is missing")
        form = form_path.read_text(encoding="utf-8")

        for field_id in (
            "tier",
            "summary",
            "sample",
            "action",
            "mapping",
            "acceptance",
            "size",
            "rows",
            "deadline",
            "data-safety",
            "scope",
        ):
            with self.subTest(field_id=field_id):
                self.assertIn(f"id: {field_id}", form)
        self.assertIn("USD 25 Report", form)
        self.assertIn("USD 75 Correct", form)
        self.assertIn("USD 150 Full", form)
        self.assertIn("no confidential, personal, or production data", form)
        self.assertIn("No store login", form)
        self.assertIn("does not guarantee import acceptance", form)

    def test_readme_exposes_bounded_ebay_preflight_request(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")

        self.assertIn("## Fixed-price eBay listing file preflight", readme)
        self.assertIn("USD 25 Report", readme)
        self.assertIn("up to 500 rows", readme)
        self.assertIn("USD 75 Correct", readme)
        self.assertIn("up to 5,000 rows", readme)
        self.assertIn("USD 150 Full", readme)
        self.assertIn("up to 50,000 rows", readme)
        self.assertIn(
            "issues/new?template=ebay-listing-file-preflight-request.yml",
            readme,
        )
        self.assertIn("does not guarantee upload acceptance", readme)
        self.assertIn("No seller account login", readme)

    def test_ebay_preflight_form_collects_bounded_safe_inputs(self) -> None:
        form_path = (
            self.root
            / ".github"
            / "ISSUE_TEMPLATE"
            / "ebay-listing-file-preflight-request.yml"
        )
        self.assertTrue(form_path.is_file(), "eBay preflight issue form is missing")
        form = form_path.read_text(encoding="utf-8")

        for field_id in (
            "tier",
            "summary",
            "sample",
            "template",
            "action",
            "site",
            "acceptance",
            "size",
            "rows",
            "deadline",
            "data-safety",
            "scope",
        ):
            with self.subTest(field_id=field_id):
                self.assertIn(f"id: {field_id}", form)
        self.assertIn("USD 25 Report", form)
        self.assertIn("USD 75 Correct", form)
        self.assertIn("USD 150 Full", form)
        self.assertIn("no confidential, personal, or production data", form)
        self.assertIn("No seller account login", form)
        self.assertIn("does not guarantee upload acceptance", form)

    def test_readme_exposes_bounded_csv_comparison_request(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")

        self.assertIn("## Fixed-price CSV comparison report", readme)
        self.assertIn("USD 25 Report", readme)
        self.assertIn("up to 500 rows per file", readme)
        self.assertIn("USD 75 Select", readme)
        self.assertIn("up to 5,000 rows per file", readme)
        self.assertIn("USD 150 Full", readme)
        self.assertIn("up to 50,000 rows per file", readme)
        self.assertIn(
            "issues/new?template=csv-comparison-report-request.yml", readme
        )
        self.assertIn("No account or shared-sheet access", readme)
        self.assertIn("No regulated, confidential, personal", readme)

    def test_csv_comparison_form_collects_bounded_safe_inputs(self) -> None:
        form_path = (
            self.root / ".github" / "ISSUE_TEMPLATE" / "csv-comparison-report-request.yml"
        )
        self.assertTrue(form_path.is_file(), "CSV comparison issue form is missing")
        form = form_path.read_text(encoding="utf-8")

        for field_id in (
            "tier",
            "summary",
            "sample",
            "key",
            "columns",
            "acceptance",
            "size",
            "rows",
            "deadline",
            "data-safety",
            "scope",
        ):
            with self.subTest(field_id=field_id):
                self.assertIn(f"id: {field_id}", form)
        self.assertIn("USD 25 Report", form)
        self.assertIn("USD 75 Select", form)
        self.assertIn("USD 150 Full", form)
        self.assertIn("no regulated, confidential, personal", form)
        self.assertIn("No account or shared-sheet access", form)
        self.assertIn("does not modify either input", form)

    def test_readme_exposes_bounded_redirect_map_preflight_request(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")

        self.assertIn("## Fixed-price redirect map preflight", readme)
        self.assertIn("USD 25 Report", readme)
        self.assertIn("up to 500 mappings", readme)
        self.assertIn("USD 75 Correct", readme)
        self.assertIn("up to 5,000 mappings", readme)
        self.assertIn("USD 150 Full", readme)
        self.assertIn("up to 50,000 mappings", readme)
        self.assertIn(
            "issues/new?template=redirect-map-preflight-request.yml", readme
        )
        self.assertIn("No site, server, CMS, analytics, or Search Console access", readme)
        self.assertIn("publicly known URLs only", readme)

    def test_redirect_map_form_collects_bounded_safe_inputs(self) -> None:
        form_path = (
            self.root / ".github" / "ISSUE_TEMPLATE" / "redirect-map-preflight-request.yml"
        )
        self.assertTrue(form_path.is_file(), "redirect map issue form is missing")
        form = form_path.read_text(encoding="utf-8")

        for field_id in (
            "tier",
            "summary",
            "sample",
            "headers",
            "redirects",
            "acceptance",
            "size",
            "rows",
            "deadline",
            "data-safety",
            "scope",
        ):
            with self.subTest(field_id=field_id):
                self.assertIn(f"id: {field_id}", form)
        self.assertIn("USD 25 Report", form)
        self.assertIn("USD 75 Correct", form)
        self.assertIn("USD 150 Full", form)
        self.assertIn("publicly known URLs only", form)
        self.assertIn("No site, server, CMS, analytics, or Search Console access", form)
        self.assertIn("does not guarantee search performance", form)

    def test_readme_exposes_bounded_csv_batch_service(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")

        self.assertIn("## Fixed-price CSV batch preflight and combine", readme)
        self.assertIn("USD 25 Report", readme)
        self.assertIn("up to 30 files", readme)
        self.assertIn("USD 75 Combine", readme)
        self.assertIn("up to 100 files", readme)
        self.assertIn("USD 150 Full", readme)
        self.assertIn("up to 500 files", readme)
        self.assertIn("issues/new?template=csv-batch-preflight-request.yml", readme)
        self.assertIn("No email, cloud-drive, SAP, or production-system access", readme)

    def test_csv_batch_form_collects_bounded_safe_inputs(self) -> None:
        form_path = (
            self.root / ".github" / "ISSUE_TEMPLATE" / "csv-batch-preflight-request.yml"
        )
        self.assertTrue(form_path.is_file(), "CSV batch issue form is missing")
        form = form_path.read_text(encoding="utf-8")

        for field_id in (
            "tier",
            "summary",
            "sample",
            "headers",
            "order",
            "acceptance",
            "size",
            "files",
            "rows",
            "deadline",
            "data-safety",
            "scope",
        ):
            with self.subTest(field_id=field_id):
                self.assertIn(f"id: {field_id}", form)
        self.assertIn("USD 25 Report", form)
        self.assertIn("USD 75 Combine", form)
        self.assertIn("USD 150 Full", form)
        self.assertIn("no regulated, confidential, personal", form)
        self.assertIn("No email, cloud-drive, SAP, or production-system access", form)
        self.assertIn("no combine begins until the preflight passes", form)

    def test_readme_exposes_bounded_merchant_feed_preflight_service(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")

        self.assertIn("## Fixed-price Merchant product feed preflight", readme)
        self.assertIn("USD 25 Report", readme)
        self.assertIn("up to 500 rows", readme)
        self.assertIn("USD 75 Correct", readme)
        self.assertIn("up to 5,000 rows", readme)
        self.assertIn("USD 150 Full", readme)
        self.assertIn("up to 50,000 rows", readme)
        self.assertIn(
            "issues/new?template=merchant-product-feed-preflight-request.yml",
            readme,
        )
        self.assertIn(
            "No Merchant Center, Google Ads, store, or production-system access",
            readme,
        )

    def test_merchant_feed_form_collects_bounded_safe_inputs(self) -> None:
        form_path = (
            self.root
            / ".github"
            / "ISSUE_TEMPLATE"
            / "merchant-product-feed-preflight-request.yml"
        )
        self.assertTrue(form_path.is_file(), "Merchant feed issue form is missing")
        form = form_path.read_text(encoding="utf-8")

        for field_id in (
            "tier",
            "summary",
            "sample",
            "format",
            "headers",
            "acceptance",
            "size",
            "rows",
            "deadline",
            "data-safety",
            "scope",
        ):
            with self.subTest(field_id=field_id):
                self.assertIn(f"id: {field_id}", form)
        self.assertIn("USD 25 Report", form)
        self.assertIn("USD 75 Correct", form)
        self.assertIn("USD 150 Full", form)
        self.assertIn("publicly available product catalog data only", form)
        self.assertIn(
            "No Merchant Center, Google Ads, store, or production-system access",
            form,
        )
        self.assertIn("does not guarantee approval", form)

    def test_readme_exposes_bounded_sitemap_preflight_service(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")

        self.assertIn("## Fixed-price XML sitemap preflight", readme)
        self.assertIn("USD 25 Report", readme)
        self.assertIn("up to 5,000 entries", readme)
        self.assertIn("USD 75 Correct", readme)
        self.assertIn("up to 25,000 entries", readme)
        self.assertIn("USD 150 Full", readme)
        self.assertIn("up to 50,000 entries", readme)
        self.assertIn(
            "issues/new?template=xml-sitemap-preflight-request.yml", readme
        )
        self.assertIn(
            "No site, server, CMS, hosting, analytics, or Search Console access",
            readme,
        )

    def test_sitemap_form_collects_bounded_safe_inputs(self) -> None:
        form_path = (
            self.root / ".github" / "ISSUE_TEMPLATE" / "xml-sitemap-preflight-request.yml"
        )
        self.assertTrue(form_path.is_file(), "XML sitemap issue form is missing")
        form = form_path.read_text(encoding="utf-8")

        for field_id in (
            "tier",
            "summary",
            "sample",
            "kind",
            "entries",
            "acceptance",
            "size",
            "deadline",
            "data-safety",
            "scope",
        ):
            with self.subTest(field_id=field_id):
                self.assertIn(f"id: {field_id}", form)
        self.assertIn("USD 25 Report", form)
        self.assertIn("USD 75 Correct", form)
        self.assertIn("USD 150 Full", form)
        self.assertIn("public website sitemap", form)
        self.assertIn(
            "No site, server, CMS, hosting, analytics, or Search Console access",
            form,
        )
        self.assertIn("does not guarantee crawling or indexing", form)

    def test_readme_exposes_bounded_robots_preflight_service(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")

        self.assertIn("## Fixed-price robots.txt preflight", readme)
        self.assertIn("USD 25 Report", readme)
        self.assertIn("up to 100 lines and 50 KiB", readme)
        self.assertIn("USD 75 Correct", readme)
        self.assertIn("up to 1,000 lines and 250 KiB", readme)
        self.assertIn("USD 150 Full", readme)
        self.assertIn("up to 500 KiB", readme)
        self.assertIn(
            "issues/new?template=robots-txt-preflight-request.yml", readme
        )
        self.assertIn(
            "No site, server, CMS, hosting, analytics, or Search Console access",
            readme,
        )

    def test_robots_form_collects_bounded_safe_inputs(self) -> None:
        form_path = (
            self.root / ".github" / "ISSUE_TEMPLATE" / "robots-txt-preflight-request.yml"
        )
        self.assertTrue(form_path.is_file(), "robots.txt issue form is missing")
        form = form_path.read_text(encoding="utf-8")

        for field_id in (
            "tier",
            "summary",
            "sample",
            "groups",
            "lines",
            "acceptance",
            "size",
            "deadline",
            "data-safety",
            "scope",
        ):
            with self.subTest(field_id=field_id):
                self.assertIn(f"id: {field_id}", form)
        self.assertIn("USD 25 Report", form)
        self.assertIn("USD 75 Correct", form)
        self.assertIn("USD 150 Full", form)
        self.assertIn("public website robots.txt", form)
        self.assertIn(
            "No site, server, CMS, hosting, analytics, or Search Console access",
            form,
        )
        self.assertIn("does not guarantee crawling or indexing", form)

    def test_readme_exposes_bounded_podcast_feed_preflight_service(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")

        self.assertIn("## Fixed-price podcast RSS preflight", readme)
        self.assertIn("USD 25 Report", readme)
        self.assertIn("up to 100 episodes and 2 MB", readme)
        self.assertIn("USD 75 Correct", readme)
        self.assertIn("up to 500 episodes and 5 MB", readme)
        self.assertIn("USD 150 Full", readme)
        self.assertIn("up to 2,000 episodes and 10 MB", readme)
        self.assertIn(
            "issues/new?template=podcast-rss-preflight-request.yml", readme
        )
        self.assertIn(
            "No Apple Podcasts, Spotify, WordPress, hosting, or server access",
            readme,
        )

    def test_podcast_feed_form_collects_bounded_safe_inputs(self) -> None:
        form_path = (
            self.root
            / ".github"
            / "ISSUE_TEMPLATE"
            / "podcast-rss-preflight-request.yml"
        )
        self.assertTrue(form_path.is_file(), "Podcast RSS issue form is missing")
        form = form_path.read_text(encoding="utf-8")

        for field_id in (
            "tier",
            "summary",
            "sample",
            "episodes",
            "acceptance",
            "size",
            "deadline",
            "data-safety",
            "scope",
        ):
            with self.subTest(field_id=field_id):
                self.assertIn(f"id: {field_id}", form)
        self.assertIn("USD 25 Report", form)
        self.assertIn("USD 75 Correct", form)
        self.assertIn("USD 150 Full", form)
        self.assertIn("public podcast RSS", form)
        self.assertIn(
            "No Apple Podcasts, Spotify, WordPress, hosting, or server access",
            form,
        )
        self.assertIn("does not guarantee platform acceptance", form)

    def test_readme_exposes_bounded_social_card_preflight_service(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")

        self.assertIn("## Fixed-price social card metadata preflight", readme)
        self.assertIn("USD 25 Report", readme)
        self.assertIn("up to 100 meta tags and 2 MB", readme)
        self.assertIn("USD 75 Correct", readme)
        self.assertIn("up to 250 meta tags and 5 MB", readme)
        self.assertIn("USD 150 Full", readme)
        self.assertIn("up to 500 meta tags and 10 MB", readme)
        self.assertIn(
            "issues/new?template=social-card-metadata-preflight-request.yml",
            readme,
        )
        self.assertIn(
            "No WordPress, social-platform, CDN, hosting, or server access",
            readme,
        )

    def test_social_card_form_collects_bounded_safe_inputs(self) -> None:
        form_path = (
            self.root
            / ".github"
            / "ISSUE_TEMPLATE"
            / "social-card-metadata-preflight-request.yml"
        )
        self.assertTrue(form_path.is_file(), "social card issue form is missing")
        form = form_path.read_text(encoding="utf-8")

        for field_id in (
            "tier",
            "summary",
            "sample",
            "metadata",
            "acceptance",
            "size",
            "deadline",
            "data-safety",
            "scope",
        ):
            with self.subTest(field_id=field_id):
                self.assertIn(f"id: {field_id}", form)
        self.assertIn("USD 25 Report", form)
        self.assertIn("USD 75 Correct", form)
        self.assertIn("USD 150 Full", form)
        self.assertIn("public HTML snapshot", form)
        self.assertIn(
            "No WordPress, social-platform, CDN, hosting, or server access",
            form,
        )
        self.assertIn("does not guarantee a preview", form)

    def test_readme_exposes_bounded_json_ld_preflight_service(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")

        self.assertIn("## Fixed-price JSON-LD preflight", readme)
        self.assertIn("USD 25 Report", readme)
        self.assertIn("up to 25 JSON-LD scripts and 2 MB", readme)
        self.assertIn("USD 75 Correct", readme)
        self.assertIn("up to 100 JSON-LD scripts and 5 MB", readme)
        self.assertIn("USD 150 Full", readme)
        self.assertIn("up to 250 JSON-LD scripts and 10 MB", readme)
        self.assertIn(
            "issues/new?template=json-ld-preflight-request.yml", readme
        )
        self.assertIn(
            "No Search Console, WordPress, SEO-tool, hosting, or server access",
            readme,
        )

    def test_json_ld_form_collects_bounded_safe_inputs(self) -> None:
        form_path = (
            self.root
            / ".github"
            / "ISSUE_TEMPLATE"
            / "json-ld-preflight-request.yml"
        )
        self.assertTrue(form_path.is_file(), "JSON-LD issue form is missing")
        form = form_path.read_text(encoding="utf-8")

        for field_id in (
            "tier",
            "summary",
            "sample",
            "scripts",
            "acceptance",
            "size",
            "deadline",
            "data-safety",
            "scope",
        ):
            with self.subTest(field_id=field_id):
                self.assertIn(f"id: {field_id}", form)
        self.assertIn("USD 25 Report", form)
        self.assertIn("USD 75 Correct", form)
        self.assertIn("USD 150 Full", form)
        self.assertIn("public HTML snapshot", form)
        self.assertIn(
            "No Search Console, WordPress, SEO-tool, hosting, or server access",
            form,
        )
        self.assertIn("does not guarantee rich-result eligibility", form)

    def test_readme_exposes_bounded_rss_atom_feed_preflight_service(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")

        self.assertIn("## Fixed-price RSS and Atom feed preflight", readme)
        self.assertIn("USD 25 Report", readme)
        self.assertIn("up to 250 entries and 2 MB", readme)
        self.assertIn("USD 75 Correct", readme)
        self.assertIn("up to 2,500 entries and 5 MB", readme)
        self.assertIn("USD 150 Full", readme)
        self.assertIn("up to 10,000 entries and 10 MB", readme)
        self.assertIn(
            "issues/new?template=rss-atom-feed-preflight-request.yml", readme
        )
        self.assertIn(
            "No feed reader, CMS, hosting, or server access", readme
        )
        self.assertIn(
            "does not guarantee HTTP behavior, MIME handling, or reader acceptance",
            readme,
        )

    def test_rss_atom_feed_form_collects_bounded_safe_inputs(self) -> None:
        form_path = (
            self.root
            / ".github"
            / "ISSUE_TEMPLATE"
            / "rss-atom-feed-preflight-request.yml"
        )
        self.assertTrue(form_path.is_file(), "RSS and Atom issue form is missing")
        form = form_path.read_text(encoding="utf-8")

        for field_id in (
            "tier",
            "summary",
            "sample",
            "format",
            "entries",
            "acceptance",
            "size",
            "deadline",
            "data-safety",
            "scope",
        ):
            with self.subTest(field_id=field_id):
                self.assertIn(f"id: {field_id}", form)
        self.assertIn("USD 25 Report", form)
        self.assertIn("USD 75 Correct", form)
        self.assertIn("USD 150 Full", form)
        self.assertIn("public RSS 2.0 or Atom 1.0", form)
        self.assertIn(
            "No feed reader, CMS, hosting, or server access", form
        )
        self.assertIn(
            "does not guarantee HTTP behavior, MIME handling, or reader acceptance",
            form,
        )

    def test_issue_forms_are_valid_yaml(self) -> None:
        for filename in (
            "csv-cleanup-request.yml",
            "csv-transformation-request.yml",
            "csv-validation-request.yml",
            "csv-reporting-pipeline-request.yml",
            "csv-data-dictionary-request.yml",
            "shopify-product-csv-preflight-request.yml",
            "woocommerce-product-csv-preflight-request.yml",
            "ebay-listing-file-preflight-request.yml",
            "csv-comparison-report-request.yml",
            "redirect-map-preflight-request.yml",
            "csv-batch-preflight-request.yml",
            "merchant-product-feed-preflight-request.yml",
            "xml-sitemap-preflight-request.yml",
            "robots-txt-preflight-request.yml",
            "podcast-rss-preflight-request.yml",
            "social-card-metadata-preflight-request.yml",
            "json-ld-preflight-request.yml",
            "public-calendar-file-preflight-request.yml",
            "rss-atom-feed-preflight-request.yml",
        ):
            with self.subTest(filename=filename):
                path = self.root / ".github" / "ISSUE_TEMPLATE" / filename
                completed = subprocess.run(
                    [
                        "ruby",
                        "-e",
                        (
                            'require "yaml"; require "json"; '
                            "print JSON.generate(YAML.safe_load(File.read(ARGV[0]), aliases: true))"
                        ),
                        str(path),
                    ],
                    cwd=self.root,
                    check=True,
                    capture_output=True,
                    text=True,
                )
                form = json.loads(completed.stdout)
                self.assertIsInstance(form["body"], list)
                self.assertGreater(len(form["body"]), 0)


if __name__ == "__main__":
    unittest.main()
