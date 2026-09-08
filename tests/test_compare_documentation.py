import unittest
from pathlib import Path


class CsvComparisonDocumentationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(__file__).resolve().parents[1]

    def test_public_readmes_document_value_free_comparison_contract(self) -> None:
        command = (
            'data-shape-kit --compare-to current.csv --key "SKU" '
            "previous.csv comparison.md"
        )
        for filename in ("README.md", "PYPI_README.md"):
            with self.subTest(filename=filename):
                text = (self.root / filename).read_text(encoding="utf-8")
                self.assertIn(command, text)
                self.assertIn("does not include source cell values", text)
                self.assertIn("duplicate keys", text)
                self.assertIn("changed row pairs", text)
                self.assertIn("does not modify either input", text)

    def test_guide_has_checks_safety_and_service_path(self) -> None:
        guide_path = self.root / "docs" / "csv-comparison-report-checklist.md"
        self.assertTrue(guide_path.is_file(), "CSV comparison guide is missing")
        guide = guide_path.read_text(encoding="utf-8")
        for required_text in (
            "# CSV Comparison Report Checklist",
            "Last verified: 2026-09-08",
            'data-shape-kit --compare-to current.csv --key "SKU" previous.csv comparison.md',
            "does not include source cell values",
            "synthetic or fully redacted sample",
            "USD 25",
            "USD 75",
            "USD 150",
            "no regulated, confidential, personal, financial, medical, education, identity, credential, or production data",
            "issues/new?template=csv-comparison-report-request.yml",
        ):
            with self.subTest(required_text=required_text):
                self.assertIn(required_text, guide)

        readme = (self.root / "README.md").read_text(encoding="utf-8")
        self.assertIn("docs/csv-comparison-report-checklist.md", readme)

    def test_github_install_command_is_pinned_to_new_version(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")
        command = (
            'python -m pip install "data-shape-kit @ '
            'https://github.com/tevinch/data-shape-kit/archive/refs/tags/v0.13.0.tar.gz"'
        )
        self.assertIn(command, readme)
        self.assertNotIn("archive/refs/tags/v0.7.0.tar.gz", readme)


if __name__ == "__main__":
    unittest.main()
