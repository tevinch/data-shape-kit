import unittest
from pathlib import Path


class RedirectDocumentationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(__file__).resolve().parents[1]

    def test_public_readmes_document_local_value_free_contract(self) -> None:
        command = "data-shape-kit --redirect-preflight redirects.csv preflight.md"
        for filename in ("README.md", "PYPI_README.md"):
            with self.subTest(filename=filename):
                text = (self.root / filename).read_text(encoding="utf-8")
                self.assertIn(command, text)
                self.assertIn("does not include source cell values", text)
                self.assertIn("redirect chains and cycles", text)
                self.assertIn("does not make network requests", text)
                self.assertIn("does not guarantee search performance", text)

    def test_readme_and_guide_link_current_google_guidance(self) -> None:
        official_urls = (
            "https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes",
            "https://developers.google.com/search/docs/crawling-indexing/301-redirects",
        )
        guide_path = self.root / "docs" / "redirect-map-preflight-checklist.md"
        self.assertTrue(guide_path.is_file(), "redirect preflight guide is missing")
        guide = guide_path.read_text(encoding="utf-8")
        readme = (self.root / "README.md").read_text(encoding="utf-8")
        for url in official_urls:
            with self.subTest(url=url):
                self.assertIn(url, guide)
                self.assertIn(url, readme)
        for required_text in (
            "# Redirect Map Preflight Checklist",
            "Last verified: 2026-09-08",
            "synthetic or publicly known URL sample",
            "USD 25",
            "USD 75",
            "USD 150",
            "issues/new?template=redirect-map-preflight-request.yml",
            "does not guarantee search performance",
        ):
            with self.subTest(required_text=required_text):
                self.assertIn(required_text, guide)
        self.assertIn("docs/redirect-map-preflight-checklist.md", readme)

    def test_github_install_command_is_pinned_to_new_version(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")
        command = (
            'python -m pip install "data-shape-kit @ '
            'https://github.com/tevinch/data-shape-kit/archive/refs/tags/v0.15.0.tar.gz"'
        )
        self.assertIn(command, readme)
        self.assertNotIn("archive/refs/tags/v0.7.0.tar.gz", readme)


if __name__ == "__main__":
    unittest.main()
