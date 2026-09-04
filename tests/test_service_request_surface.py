import unittest
from pathlib import Path


class RepositorySurfaceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(__file__).resolve().parents[1]

    def test_readme_exposes_bounded_cleanup_request(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")

        self.assertIn("## Fixed-price CSV cleanup", readme)
        self.assertIn("USD 25", readme)
        self.assertIn("one UTF-8 CSV up to 10 MB", readme)
        self.assertIn(
            "issues/new?template=csv-cleanup-request.yml",
            readme,
        )
        self.assertIn("Do not attach confidential, personal, or production data", readme)

    def test_issue_form_collects_safe_acceptance_inputs(self) -> None:
        form_path = (
            self.root / ".github" / "ISSUE_TEMPLATE" / "csv-cleanup-request.yml"
        )
        self.assertTrue(form_path.is_file(), "CSV cleanup issue form is missing")
        form = form_path.read_text(encoding="utf-8")

        for field_id in (
            "summary",
            "sample",
            "cleanup",
            "acceptance",
            "size",
            "deadline",
            "data-safety",
            "scope",
        ):
            with self.subTest(field_id=field_id):
                self.assertIn(f"id: {field_id}", form)
        self.assertIn("USD 25", form)
        self.assertIn("no confidential, personal, or production data", form)


if __name__ == "__main__":
    unittest.main()
