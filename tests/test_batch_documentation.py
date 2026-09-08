import unittest
from pathlib import Path


class BatchDocumentationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(__file__).resolve().parents[1]

    def test_public_readmes_document_local_value_free_contract(self) -> None:
        command = "data-shape-kit --batch-preflight exports/ batch-report.md"
        for filename in ("README.md", "PYPI_README.md"):
            with self.subTest(filename=filename):
                text = (self.root / filename).read_text(encoding="utf-8")
                self.assertIn(command, text)
                self.assertIn("does not include file names", text)
                self.assertIn("does not include source cell values", text)
                self.assertIn("does not read subdirectories", text)
                self.assertIn("does not combine or modify files", text)

    def test_guide_has_safety_findings_and_service_path(self) -> None:
        guide_path = self.root / "docs" / "csv-batch-preflight-checklist.md"
        self.assertTrue(guide_path.is_file(), "batch preflight guide is missing")
        guide = guide_path.read_text(encoding="utf-8")
        for required_text in (
            "# CSV Batch Preflight Checklist",
            "Last verified: 2026-09-08",
            "stable file numbers",
            "schema_mismatch",
            "malformed_row",
            "synthetic or fully redacted sample",
            "USD 25",
            "USD 75",
            "USD 150",
            "issues/new?template=csv-batch-preflight-request.yml",
        ):
            with self.subTest(required_text=required_text):
                self.assertIn(required_text, guide)
        readme = (self.root / "README.md").read_text(encoding="utf-8")
        self.assertIn("docs/csv-batch-preflight-checklist.md", readme)

    def test_github_install_command_is_pinned_to_new_version(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")
        command = (
            'python -m pip install "data-shape-kit @ '
            'https://github.com/tevinch/data-shape-kit/archive/refs/tags/v0.10.0.tar.gz"'
        )
        self.assertIn(command, readme)
        self.assertNotIn("archive/refs/tags/v0.8.0.tar.gz", readme)


if __name__ == "__main__":
    unittest.main()
