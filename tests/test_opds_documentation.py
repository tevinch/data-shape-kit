import unittest
from pathlib import Path


class OpdsDocumentationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(__file__).resolve().parents[1]

    def test_public_readmes_document_offline_value_free_contract(self) -> None:
        command = "data-shape-kit --opds-preflight catalog.json preflight.md"
        for filename in ("README.md", "PYPI_README.md"):
            with self.subTest(filename=filename):
                text = (self.root / filename).read_text(encoding="utf-8")
                self.assertIn(command, text)
                self.assertIn("OPDS 2.0", text)
                self.assertIn("does not include source catalog values", text)
                self.assertIn("does not make network requests", text)
                self.assertIn("paid, borrowed, subscribed", text)
                self.assertIn(
                    "does not guarantee HTTP behavior, MIME handling, "
                    "or reader acceptance",
                    text,
                )

    def test_guide_has_sources_checks_safety_and_service_path(self) -> None:
        guide_path = self.root / "docs" / "opds-2-catalog-preflight-checklist.md"
        self.assertTrue(guide_path.is_file(), "OPDS 2.0 guide is missing")
        guide = guide_path.read_text(encoding="utf-8")
        for required_text in (
            "# OPDS 2.0 Catalog Preflight Checklist",
            "Last verified: 2026-09-09",
            "missing_feed_title",
            "missing_feed_self_link",
            "missing_navigation_title",
            "missing_public_acquisition",
            "missing_supported_publication_image",
            "official JSON Schema",
            "USD 25",
            "USD 75",
            "USD 150",
            "issues/new?template=opds-2-catalog-preflight-request.yml",
            "https://specs.opds.io/opds-2.0",
            "https://specs.opds.io/schema/feed.schema.json",
            "https://specs.opds.io/schema/publication.schema.json",
        ):
            with self.subTest(required_text=required_text):
                self.assertIn(required_text, guide)
        self.assertIn(
            "docs/opds-2-catalog-preflight-checklist.md",
            (self.root / "README.md").read_text(encoding="utf-8"),
        )

    def test_github_install_command_is_pinned_to_new_version(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")
        command = (
            'python -m pip install "data-shape-kit @ '
            'https://github.com/tevinch/data-shape-kit/archive/refs/tags/v0.18.0.tar.gz"'
        )
        self.assertIn(command, readme)
        self.assertNotIn("archive/refs/tags/v0.17.0.tar.gz", readme)


if __name__ == "__main__":
    unittest.main()
