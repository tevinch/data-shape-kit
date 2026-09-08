import unittest
from pathlib import Path


class JsonLdDocumentationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(__file__).resolve().parents[1]

    def test_public_readmes_document_offline_value_free_contract(self) -> None:
        command = "data-shape-kit --json-ld-preflight page.html preflight.md"
        for filename in ("README.md", "PYPI_README.md"):
            with self.subTest(filename=filename):
                text = (self.root / filename).read_text(encoding="utf-8")
                self.assertIn(command, text)
                self.assertIn("JSON-LD", text)
                self.assertIn("does not include source JSON-LD values", text)
                self.assertIn("does not make network requests", text)
                self.assertIn("does not resolve remote contexts", text)
                self.assertIn("does not guarantee rich-result eligibility", text)

    def test_guide_has_current_sources_checks_safety_and_service_path(self) -> None:
        guide_path = self.root / "docs" / "json-ld-preflight-checklist.md"
        self.assertTrue(guide_path.is_file(), "JSON-LD guide is missing")
        guide = guide_path.read_text(encoding="utf-8")
        for required_text in (
            "# JSON-LD Preflight Checklist",
            "Last verified: 2026-09-08",
            "JSON-LD 1.1",
            "invalid_json_syntax",
            "duplicate_json_member",
            "duplicate_json_ld_block",
            "repeated_id",
            "public HTML snapshot",
            "review-only warning",
            "USD 25",
            "USD 75",
            "USD 150",
            "issues/new?template=json-ld-preflight-request.yml",
            "https://www.w3.org/TR/json-ld11/",
            "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data",
            "https://developers.google.com/search/docs/appearance/structured-data/sd-policies",
        ):
            with self.subTest(required_text=required_text):
                self.assertIn(required_text, guide)
        self.assertIn(
            "docs/json-ld-preflight-checklist.md",
            (self.root / "README.md").read_text(encoding="utf-8"),
        )

    def test_github_install_command_is_pinned_to_new_version(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")
        command = (
            'python -m pip install "data-shape-kit @ '
            'https://github.com/tevinch/data-shape-kit/archive/refs/tags/v0.16.0.tar.gz"'
        )
        self.assertIn(command, readme)
        self.assertNotIn("archive/refs/tags/v0.14.0.tar.gz", readme)


if __name__ == "__main__":
    unittest.main()
