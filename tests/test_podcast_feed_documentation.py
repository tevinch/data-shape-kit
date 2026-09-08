import unittest
from pathlib import Path


class PodcastFeedDocumentationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(__file__).resolve().parents[1]

    def test_public_readmes_document_offline_value_free_contract(self) -> None:
        command = (
            "data-shape-kit --podcast-feed-preflight feed.xml preflight.md"
        )
        for filename in ("README.md", "PYPI_README.md"):
            with self.subTest(filename=filename):
                text = (self.root / filename).read_text(encoding="utf-8")
                self.assertIn(command, text)
                self.assertIn("Podcast RSS", text)
                self.assertIn("does not include source feed values", text)
                self.assertIn("does not make network requests", text)
                self.assertIn("does not guarantee platform acceptance", text)

    def test_guide_has_current_sources_checks_safety_and_service_path(self) -> None:
        guide_path = self.root / "docs" / "podcast-rss-preflight-checklist.md"
        self.assertTrue(guide_path.is_file(), "Podcast RSS guide is missing")
        guide = guide_path.read_text(encoding="utf-8")
        for required_text in (
            "# Podcast RSS Preflight Checklist",
            "Last verified: 2026-09-08",
            "RSS 2.0",
            "missing_channel_title",
            "missing_artwork",
            "duplicate_enclosure_url",
            "invalid_pub_date",
            "public podcast RSS",
            "USD 25",
            "USD 75",
            "USD 150",
            "issues/new?template=podcast-rss-preflight-request.yml",
            "https://podcasters.apple.com/support/823-podcast-requirements",
            "https://www.rssboard.org/rss-specification",
        ):
            with self.subTest(required_text=required_text):
                self.assertIn(required_text, guide)
        self.assertIn(
            "docs/podcast-rss-preflight-checklist.md",
            (self.root / "README.md").read_text(encoding="utf-8"),
        )

    def test_github_install_command_is_pinned_to_new_version(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")
        command = (
            'python -m pip install "data-shape-kit @ '
            'https://github.com/tevinch/data-shape-kit/archive/refs/tags/v0.15.0.tar.gz"'
        )
        self.assertIn(command, readme)
        self.assertNotIn("archive/refs/tags/v0.12.0.tar.gz", readme)


if __name__ == "__main__":
    unittest.main()
