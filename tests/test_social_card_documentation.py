import unittest
from pathlib import Path


class SocialCardDocumentationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(__file__).resolve().parents[1]

    def test_public_readmes_document_offline_value_free_contract(self) -> None:
        command = "data-shape-kit --social-card-preflight page.html preflight.md"
        for filename in ("README.md", "PYPI_README.md"):
            with self.subTest(filename=filename):
                text = (self.root / filename).read_text(encoding="utf-8")
                self.assertIn(command, text)
                self.assertIn("Open Graph", text)
                self.assertIn("does not include source metadata values", text)
                self.assertIn("does not make network requests", text)
                self.assertIn("does not guarantee a preview", text)

    def test_guide_has_current_source_checks_safety_and_service_path(self) -> None:
        guide_path = (
            self.root / "docs" / "social-card-metadata-preflight-checklist.md"
        )
        self.assertTrue(guide_path.is_file(), "social card guide is missing")
        guide = guide_path.read_text(encoding="utf-8")
        for required_text in (
            "# Social Card Metadata Preflight Checklist",
            "Last verified: 2026-09-08",
            "Open Graph protocol",
            "missing_og_title",
            "missing_og_image_alt",
            "duplicate_og_image",
            "og_metadata_outside_head",
            "public HTML snapshot",
            "USD 25",
            "USD 75",
            "USD 150",
            "issues/new?template=social-card-metadata-preflight-request.yml",
            "https://ogp.me/",
        ):
            with self.subTest(required_text=required_text):
                self.assertIn(required_text, guide)
        self.assertIn(
            "docs/social-card-metadata-preflight-checklist.md",
            (self.root / "README.md").read_text(encoding="utf-8"),
        )

    def test_github_install_command_is_pinned_to_new_version(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")
        command = (
            'python -m pip install "data-shape-kit @ '
            'https://github.com/tevinch/data-shape-kit/archive/refs/tags/v0.16.0.tar.gz"'
        )
        self.assertIn(command, readme)
        self.assertNotIn("archive/refs/tags/v0.13.0.tar.gz", readme)


if __name__ == "__main__":
    unittest.main()
