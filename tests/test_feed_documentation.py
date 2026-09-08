import unittest
from pathlib import Path


class FeedDocumentationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(__file__).resolve().parents[1]

    def test_public_readmes_document_offline_value_free_contract(self) -> None:
        command = "data-shape-kit --feed-preflight feed.xml preflight.md"
        for filename in ("README.md", "PYPI_README.md"):
            with self.subTest(filename=filename):
                text = (self.root / filename).read_text(encoding="utf-8")
                self.assertIn(command, text)
                self.assertIn("RSS 2.0 and Atom 1.0", text)
                self.assertIn("does not include source feed values", text)
                self.assertIn("does not make network requests", text)
                self.assertIn("contact-email", text)
                self.assertIn(
                    "does not guarantee HTTP behavior, MIME handling, or reader acceptance",
                    text,
                )

    def test_guide_has_sources_checks_safety_and_service_path(self) -> None:
        guide_path = self.root / "docs" / "rss-atom-feed-preflight-checklist.md"
        self.assertTrue(guide_path.is_file(), "RSS and Atom guide is missing")
        guide = guide_path.read_text(encoding="utf-8")
        for required_text in (
            "# RSS and Atom Feed Preflight Checklist",
            "Last verified: 2026-09-09",
            "RSS 2.0",
            "Atom 1.0",
            "missing_channel_title",
            "duplicate_item_guid",
            "missing_feed_updated",
            "missing_entry_author",
            "duplicate_entry_id",
            "contact-email",
            "authenticated, tokenized, or private",
            "USD 25",
            "USD 75",
            "USD 150",
            "issues/new?template=rss-atom-feed-preflight-request.yml",
            "https://www.rssboard.org/rss-specification",
            "https://www.rfc-editor.org/rfc/rfc4287.html",
            "https://validator.w3.org/feed/docs/",
        ):
            with self.subTest(required_text=required_text):
                self.assertIn(required_text, guide)
        self.assertIn(
            "docs/rss-atom-feed-preflight-checklist.md",
            (self.root / "README.md").read_text(encoding="utf-8"),
        )

    def test_github_install_command_is_pinned_to_new_version(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")
        command = (
            'python -m pip install "data-shape-kit @ '
            'https://github.com/tevinch/data-shape-kit/archive/refs/tags/v0.17.0.tar.gz"'
        )
        self.assertIn(command, readme)
        self.assertNotIn("archive/refs/tags/v0.16.0.tar.gz", readme)


if __name__ == "__main__":
    unittest.main()
