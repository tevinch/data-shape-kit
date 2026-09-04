import unittest
from pathlib import Path


class ShopifyGuideTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(__file__).resolve().parents[1]
        self.guide_path = (
            self.root / "docs" / "shopify-product-csv-preflight-checklist.md"
        )

    def test_guide_has_sources_checks_safety_and_service_path(self) -> None:
        self.assertTrue(self.guide_path.is_file(), "preflight guide is missing")
        guide = self.guide_path.read_text(encoding="utf-8")

        for required_text in (
            "# Shopify Product CSV Preflight Checklist",
            "Last verified: 2026-09-04",
            "independent and is not endorsed by Shopify",
            "## 1. Export a backup before editing",
            "## 2. Preserve UTF-8 and CSV quoting",
            "## 3. Keep exact headers",
            "## 4. Keep each product's rows together",
            "## 5. Keep variant dependencies together",
            "## 6. Run the local preflight",
            "data-shape-kit --shopify-preflight products.csv preflight.md",
            "does not include source cell values",
            "## What the check does not prove",
            "does not guarantee import acceptance",
            "synthetic or fully redacted sample",
            "USD 150",
            "issues/new?template=shopify-product-csv-preflight-request.yml",
        ):
            with self.subTest(required_text=required_text):
                self.assertIn(required_text, guide)

        for official_url in (
            "https://help.shopify.com/en/manual/products/import-export/using-csv",
            "https://help.shopify.com/en/manual/products/import-export/import-products",
            "https://help.shopify.com/en/manual/products/import-export/export-products",
            "https://help.shopify.com/en/manual/products/import-export/common-import-issues",
        ):
            with self.subTest(official_url=official_url):
                self.assertIn(official_url, guide)

    def test_readme_links_to_the_guide(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")

        self.assertIn(
            "docs/shopify-product-csv-preflight-checklist.md",
            readme,
        )
        self.assertIn("Shopify product CSV preflight checklist", readme)


if __name__ == "__main__":
    unittest.main()
