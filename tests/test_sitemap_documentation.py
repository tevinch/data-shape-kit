import unittest
from pathlib import Path


class SitemapDocumentationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(__file__).resolve().parents[1]

    def test_public_readmes_document_offline_value_free_contract(self) -> None:
        command = "data-shape-kit --sitemap-preflight sitemap.xml preflight.md"
        for filename in ("README.md", "PYPI_README.md"):
            with self.subTest(filename=filename):
                text = (self.root / filename).read_text(encoding="utf-8")
                self.assertIn(command, text)
                self.assertIn("XML sitemap", text)
                self.assertIn("does not include source URL values", text)
                self.assertIn("does not make network requests", text)
                self.assertIn("does not guarantee crawling or indexing", text)

    def test_guide_has_current_sources_checks_safety_and_service_path(self) -> None:
        guide_path = self.root / "docs" / "xml-sitemap-preflight-checklist.md"
        self.assertTrue(guide_path.is_file(), "XML sitemap guide is missing")
        guide = guide_path.read_text(encoding="utf-8")
        for required_text in (
            "# XML Sitemap Preflight Checklist",
            "Last verified: 2026-09-08",
            "50,000",
            "50 MB",
            "invalid_namespace",
            "missing_loc",
            "duplicate_loc",
            "invalid_lastmod",
            "DTD and entity declarations",
            "public website sitemap",
            "USD 25",
            "USD 75",
            "USD 150",
            "issues/new?template=xml-sitemap-preflight-request.yml",
            "https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap?hl=en",
            "https://www.sitemaps.org/protocol.html",
        ):
            with self.subTest(required_text=required_text):
                self.assertIn(required_text, guide)
        self.assertIn(
            "docs/xml-sitemap-preflight-checklist.md",
            (self.root / "README.md").read_text(encoding="utf-8"),
        )

    def test_github_install_command_is_pinned_to_new_version(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")
        command = (
            'python -m pip install "data-shape-kit @ '
            'https://github.com/tevinch/data-shape-kit/archive/refs/tags/v0.15.0.tar.gz"'
        )
        self.assertIn(command, readme)
        self.assertNotIn("archive/refs/tags/v0.10.0.tar.gz", readme)


if __name__ == "__main__":
    unittest.main()
