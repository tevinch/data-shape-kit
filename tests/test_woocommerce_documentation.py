import unittest
from pathlib import Path


class WooCommerceDocumentationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(__file__).resolve().parents[1]

    def test_public_readmes_document_local_preflight_contract(self) -> None:
        for filename in ("README.md", "PYPI_README.md"):
            with self.subTest(filename=filename):
                text = (self.root / filename).read_text(encoding="utf-8")
                self.assertIn(
                    "data-shape-kit --woocommerce-preflight products.csv preflight.md",
                    text,
                )
                self.assertIn("does not include source cell values", text)
                self.assertIn("does not guarantee import acceptance", text)
                self.assertIn("Published", text)
                self.assertIn("Parent", text)

    def test_readme_links_to_current_official_woocommerce_guidance(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")
        self.assertIn(
            "https://woocommerce.com/document/product-csv-importer-exporter/",
            readme,
        )

    def test_guide_has_sources_checks_safety_and_service_path(self) -> None:
        guide_path = (
            self.root / "docs" / "woocommerce-product-csv-preflight-checklist.md"
        )
        self.assertTrue(guide_path.is_file(), "WooCommerce preflight guide is missing")
        guide = guide_path.read_text(encoding="utf-8")
        for required_text in (
            "# WooCommerce Product CSV Preflight Checklist",
            "Last verified: 2026-09-04",
            "independent and is not endorsed by WooCommerce",
            "data-shape-kit --woocommerce-preflight products.csv preflight.md",
            "does not include source cell values",
            "does not guarantee import acceptance",
            "synthetic or fully redacted sample",
            "USD 25",
            "USD 75",
            "USD 150",
            "issues/new?template=woocommerce-product-csv-preflight-request.yml",
            "https://woocommerce.com/document/product-csv-importer-exporter/",
        ):
            with self.subTest(required_text=required_text):
                self.assertIn(required_text, guide)

        readme = (self.root / "README.md").read_text(encoding="utf-8")
        self.assertIn("docs/woocommerce-product-csv-preflight-checklist.md", readme)

    def test_github_install_command_is_pinned_to_new_version(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")
        command = (
            'python -m pip install "data-shape-kit @ '
            'https://github.com/tevinch/data-shape-kit/archive/refs/tags/v0.5.0.tar.gz"'
        )
        self.assertIn(command, readme)
        self.assertNotIn("archive/refs/tags/v0.4.0.tar.gz", readme)


if __name__ == "__main__":
    unittest.main()
