import unittest
from pathlib import Path


class MerchantFeedDocumentationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(__file__).resolve().parents[1]

    def test_public_readmes_document_offline_value_free_contract(self) -> None:
        command = (
            "data-shape-kit --merchant-feed-preflight products.tsv preflight.md"
        )
        for filename in ("README.md", "PYPI_README.md"):
            with self.subTest(filename=filename):
                text = (self.root / filename).read_text(encoding="utf-8")
                self.assertIn(command, text)
                self.assertIn("tab-delimited", text)
                self.assertIn("does not include source cell values", text)
                self.assertIn("does not make network requests", text)
                self.assertIn("does not guarantee approval", text)

    def test_guide_has_current_sources_checks_safety_and_service_path(self) -> None:
        guide_path = self.root / "docs" / "merchant-product-feed-preflight-checklist.md"
        self.assertTrue(guide_path.is_file(), "Merchant feed guide is missing")
        guide = guide_path.read_text(encoding="utf-8")
        for required_text in (
            "# Merchant Product Feed Preflight Checklist",
            "Last verified: 2026-09-08",
            "independent and is not endorsed by Google",
            "missing_id_header",
            "duplicate_id",
            "missing_availability_date",
            "synthetic or fully redacted sample",
            "publicly available product catalog data only",
            "USD 25",
            "USD 75",
            "USD 150",
            "issues/new?template=merchant-product-feed-preflight-request.yml",
            "https://support.google.com/merchants/answer/7052112?hl=en",
            "https://support.google.com/merchants/answer/14989239?hl=en",
            "https://support.google.com/merchants/answer/16989427?hl=en",
        ):
            with self.subTest(required_text=required_text):
                self.assertIn(required_text, guide)
        self.assertIn(
            "docs/merchant-product-feed-preflight-checklist.md",
            (self.root / "README.md").read_text(encoding="utf-8"),
        )

    def test_github_install_command_is_pinned_to_new_version(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")
        command = (
            'python -m pip install "data-shape-kit @ '
            'https://github.com/tevinch/data-shape-kit/archive/refs/tags/v0.10.0.tar.gz"'
        )
        self.assertIn(command, readme)
        self.assertNotIn("archive/refs/tags/v0.9.0.tar.gz", readme)


if __name__ == "__main__":
    unittest.main()
