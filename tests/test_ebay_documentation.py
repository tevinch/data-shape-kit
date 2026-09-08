import unittest
from pathlib import Path


class EbayDocumentationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(__file__).resolve().parents[1]

    def test_public_readmes_document_local_preflight_contract(self) -> None:
        for filename in ("README.md", "PYPI_README.md"):
            with self.subTest(filename=filename):
                text = (self.root / filename).read_text(encoding="utf-8")
                self.assertIn(
                    "data-shape-kit --ebay-preflight listings.csv preflight.md",
                    text,
                )
                self.assertIn("does not include source cell values", text)
                self.assertIn("does not guarantee upload acceptance", text)
                self.assertIn("Action", text)
                self.assertIn("Relationship details", text)

    def test_readme_links_to_current_official_ebay_guidance(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")
        self.assertIn(
            "https://www.ebay.com/help/selling/selling-tools/seller-hub-reports?id=4096",
            readme,
        )
        self.assertIn(
            "https://pages.ebay.com/sh/reports/help/create-listings-bulk/",
            readme,
        )

    def test_guide_has_sources_checks_safety_and_service_path(self) -> None:
        guide_path = self.root / "docs" / "ebay-listing-file-preflight-checklist.md"
        self.assertTrue(guide_path.is_file(), "eBay preflight guide is missing")
        guide = guide_path.read_text(encoding="utf-8")
        for required_text in (
            "# eBay Listing File Preflight Checklist",
            "Last verified: 2026-09-08",
            "independent and is not endorsed by eBay",
            "data-shape-kit --ebay-preflight listings.csv preflight.md",
            "does not include source cell values",
            "does not guarantee upload acceptance",
            "synthetic or fully redacted sample",
            "USD 25",
            "USD 75",
            "USD 150",
            "issues/new?template=ebay-listing-file-preflight-request.yml",
            "https://www.ebay.com/help/selling/selling-tools/seller-hub-reports?id=4096",
            "https://pages.ebay.com/sh/reports/help/create-listings-bulk/",
        ):
            with self.subTest(required_text=required_text):
                self.assertIn(required_text, guide)

        readme = (self.root / "README.md").read_text(encoding="utf-8")
        self.assertIn("docs/ebay-listing-file-preflight-checklist.md", readme)

    def test_github_install_command_is_pinned_to_new_version(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")
        command = (
            'python -m pip install "data-shape-kit @ '
            'https://github.com/tevinch/data-shape-kit/archive/refs/tags/v0.10.0.tar.gz"'
        )
        self.assertIn(command, readme)
        self.assertNotIn("archive/refs/tags/v0.5.0.tar.gz", readme)


if __name__ == "__main__":
    unittest.main()
