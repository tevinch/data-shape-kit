import json
import subprocess
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

    def test_readme_exposes_bounded_transformation_request(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")

        self.assertIn("## Fixed-price CSV transformation", readme)
        self.assertIn("USD 50", readme)
        self.assertIn("up to five deterministic column rules", readme)
        self.assertIn("standalone Python script and test suite", readme)
        self.assertIn(
            "issues/new?template=csv-transformation-request.yml",
            readme,
        )
        self.assertIn("No account access", readme)

    def test_transformation_form_collects_bounded_safe_inputs(self) -> None:
        form_path = (
            self.root
            / ".github"
            / "ISSUE_TEMPLATE"
            / "csv-transformation-request.yml"
        )
        self.assertTrue(form_path.is_file(), "CSV transformation form is missing")
        form = form_path.read_text(encoding="utf-8")

        for field_id in (
            "summary",
            "sample",
            "rules",
            "acceptance",
            "columns",
            "size",
            "deadline",
            "data-safety",
            "scope",
        ):
            with self.subTest(field_id=field_id):
                self.assertIn(f"id: {field_id}", form)
        self.assertIn("USD 50", form)
        self.assertIn("up to five deterministic column rules", form)
        self.assertIn("no confidential, personal, or production data", form)
        self.assertIn("No account access", form)

    def test_readme_exposes_bounded_validation_request(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")

        self.assertIn("## Fixed-price CSV validation", readme)
        self.assertIn("USD 75", readme)
        self.assertIn("up to five reproducible validation rules", readme)
        self.assertIn("read-only Python command and test suite", readme)
        self.assertIn(
            "issues/new?template=csv-validation-request.yml",
            readme,
        )
        self.assertIn("does not modify your input", readme)

    def test_validation_form_collects_bounded_safe_inputs(self) -> None:
        form_path = (
            self.root / ".github" / "ISSUE_TEMPLATE" / "csv-validation-request.yml"
        )
        self.assertTrue(form_path.is_file(), "CSV validation form is missing")
        form = form_path.read_text(encoding="utf-8")

        for field_id in (
            "summary",
            "sample",
            "rules",
            "columns",
            "report",
            "acceptance",
            "size",
            "deadline",
            "data-safety",
            "scope",
        ):
            with self.subTest(field_id=field_id):
                self.assertIn(f"id: {field_id}", form)
        self.assertIn("USD 75", form)
        self.assertIn("up to five reproducible validation rules", form)
        self.assertIn("no confidential, personal, or production data", form)
        self.assertIn("does not modify the input", form)

    def test_readme_exposes_bounded_reporting_pipeline_request(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")

        self.assertIn("## Fixed-price CSV reporting pipeline", readme)
        self.assertIn("USD 100", readme)
        self.assertIn("up to five deterministic field rules", readme)
        self.assertIn("up to three CSV outputs", readme)
        self.assertIn(
            "issues/new?template=csv-reporting-pipeline-request.yml",
            readme,
        )
        self.assertIn("one grouping key", readme)

    def test_reporting_pipeline_form_collects_bounded_safe_inputs(self) -> None:
        form_path = (
            self.root
            / ".github"
            / "ISSUE_TEMPLATE"
            / "csv-reporting-pipeline-request.yml"
        )
        self.assertTrue(form_path.is_file(), "CSV reporting pipeline form is missing")
        form = form_path.read_text(encoding="utf-8")

        for field_id in (
            "summary",
            "sample",
            "rules",
            "grouping",
            "outputs",
            "acceptance",
            "size",
            "deadline",
            "data-safety",
            "scope",
        ):
            with self.subTest(field_id=field_id):
                self.assertIn(f"id: {field_id}", form)
        self.assertIn("USD 100", form)
        self.assertIn("up to five deterministic field rules", form)
        self.assertIn("up to three CSV outputs", form)
        self.assertIn("no confidential, personal, or production data", form)
        self.assertIn("No account access", form)

    def test_readme_exposes_bounded_data_dictionary_request(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")

        self.assertIn("## Fixed-price CSV data dictionary", readme)
        self.assertIn("USD 125", readme)
        self.assertIn("up to 100 columns", readme)
        self.assertIn("Markdown data dictionary", readme)
        self.assertIn("machine-readable field specification", readme)
        self.assertIn("import readiness checklist", readme)
        self.assertIn(
            "issues/new?template=csv-data-dictionary-request.yml",
            readme,
        )
        self.assertIn("No account access", readme)

    def test_data_dictionary_form_collects_bounded_safe_inputs(self) -> None:
        form_path = (
            self.root
            / ".github"
            / "ISSUE_TEMPLATE"
            / "csv-data-dictionary-request.yml"
        )
        self.assertTrue(form_path.is_file(), "CSV data dictionary form is missing")
        form = form_path.read_text(encoding="utf-8")

        for field_id in (
            "summary",
            "sample",
            "columns",
            "definitions",
            "types",
            "required",
            "acceptance",
            "size",
            "deadline",
            "data-safety",
            "scope",
        ):
            with self.subTest(field_id=field_id):
                self.assertIn(f"id: {field_id}", form)
        self.assertIn("USD 125", form)
        self.assertIn("up to 100 columns", form)
        self.assertIn("no confidential, personal, or production data", form)
        self.assertIn("No account access", form)

    def test_issue_forms_are_valid_yaml(self) -> None:
        for filename in (
            "csv-cleanup-request.yml",
            "csv-transformation-request.yml",
            "csv-validation-request.yml",
            "csv-reporting-pipeline-request.yml",
            "csv-data-dictionary-request.yml",
        ):
            with self.subTest(filename=filename):
                path = self.root / ".github" / "ISSUE_TEMPLATE" / filename
                completed = subprocess.run(
                    [
                        "ruby",
                        "-e",
                        (
                            'require "yaml"; require "json"; '
                            "print JSON.generate(YAML.safe_load(File.read(ARGV[0]), aliases: true))"
                        ),
                        str(path),
                    ],
                    cwd=self.root,
                    check=True,
                    capture_output=True,
                    text=True,
                )
                form = json.loads(completed.stdout)
                self.assertIsInstance(form["body"], list)
                self.assertGreater(len(form["body"]), 0)


if __name__ == "__main__":
    unittest.main()
