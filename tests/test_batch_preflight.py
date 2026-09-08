import tempfile
import unittest
from pathlib import Path

from data_shape_kit.batch_preflight import (
    BatchFinding,
    BatchPreflightReport,
    preflight_csv_batch,
)
from data_shape_kit.clean import CsvShapeError


class BatchPreflightTests(unittest.TestCase):
    def test_reports_batch_shape_findings_without_names_headers_or_values(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "private-inputs"
            source.mkdir()
            target = directory / "batch-report.md"
            (source / "a-private.csv").write_text(
                "ID,Name\nsecret-1,Private one\nsecret-2,Private two\n",
                encoding="utf-8",
            )
            (source / "b-private.csv").write_text(
                "Name,ID\nPrivate three,secret-3\n", encoding="utf-8"
            )
            (source / "c-private.csv").write_text(
                "ID,ID\nsecret-4,secret-4\n", encoding="utf-8"
            )
            (source / "d-private.csv").write_text(
                "ID,\nsecret-5,Private five\n", encoding="utf-8"
            )
            (source / "e-private.csv").write_text(
                "ID,Name\nsecret-6,Private six,extra\n", encoding="utf-8"
            )
            (source / "f-private.csv").write_bytes(b"ID,Name\n\xff,broken\n")
            (source / "g-private.csv").write_text("", encoding="utf-8")
            nested = source / "nested"
            nested.mkdir()
            (nested / "ignored-private.csv").write_text(
                "Different,Headers\nsecret-7,Private seven\n", encoding="utf-8"
            )

            report = preflight_csv_batch(source, target)

            self.assertEqual(
                report,
                BatchPreflightReport(
                    file_count=7,
                    input_rows=6,
                    schema_groups=2,
                    findings=(
                        BatchFinding("missing_header", "error", 1, files=(7,)),
                        BatchFinding("invalid_utf8", "error", 1, files=(6,)),
                        BatchFinding("blank_header", "error", 1, files=(4,)),
                        BatchFinding("duplicate_header", "error", 1, files=(3,)),
                        BatchFinding("schema_mismatch", "warning", 1, files=(2,)),
                        BatchFinding(
                            "malformed_row",
                            "error",
                            1,
                            files=(5,),
                            locations=("F5:R2",),
                        ),
                    ),
                ),
            )
            output = target.read_text(encoding="utf-8")
            self.assertIn("# CSV batch preflight", output)
            self.assertIn("Schema groups: 2", output)
            self.assertIn("| malformed_row | error | 1 | 5 | F5:R2 |", output)
            self.assertIn("immediate CSV files only", output)
            for private_value in (
                "a-private.csv",
                "b-private.csv",
                "ignored-private.csv",
                "ID",
                "Name",
                "secret-1",
                "secret-6",
                "Private one",
                "Private six",
            ):
                self.assertNotIn(private_value, output)

    def test_accepts_same_schema_files_in_stable_order(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "inputs"
            source.mkdir()
            target = directory / "report.md"
            (source / "z.csv").write_text("ID,Name\n2,Two\n", encoding="utf-8")
            (source / "A.csv").write_text("ID,Name\n1,One\n", encoding="utf-8")

            report = preflight_csv_batch(source, target)

            self.assertEqual(report.file_count, 2)
            self.assertEqual(report.input_rows, 2)
            self.assertEqual(report.schema_groups, 1)
            self.assertEqual(report.findings, ())
            self.assertIn(
                "No findings from the supported local checks.",
                target.read_text(encoding="utf-8"),
            )

    def test_rejects_empty_directory_without_output(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "inputs"
            source.mkdir()
            target = directory / "report.md"

            with self.assertRaisesRegex(CsvShapeError, "expected at least one CSV file"):
                preflight_csv_batch(source, target)

            self.assertFalse(target.exists())

    def test_reports_invalid_csv_header_without_source_content(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "inputs"
            source.mkdir()
            target = directory / "report.md"
            (source / "private.csv").write_text(
                '"private unterminated header\n', encoding="utf-8"
            )

            report = preflight_csv_batch(source, target)

            self.assertEqual(report.file_count, 1)
            self.assertEqual(report.input_rows, 0)
            self.assertEqual(report.schema_groups, 0)
            self.assertEqual(
                report.findings,
                (
                    BatchFinding(
                        "invalid_csv",
                        "error",
                        1,
                        files=(1,),
                        locations=("F1:R1",),
                    ),
                ),
            )
            self.assertNotIn(
                "private unterminated header", target.read_text(encoding="utf-8")
            )

    def test_treats_a_blank_first_record_as_a_missing_header(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "inputs"
            source.mkdir()
            target = directory / "report.md"
            (source / "private.csv").write_text("\nsecret\n", encoding="utf-8")

            report = preflight_csv_batch(source, target)

            self.assertEqual(
                report.findings,
                (BatchFinding("missing_header", "error", 1, files=(1,)),),
            )
            self.assertNotIn("secret", target.read_text(encoding="utf-8"))

    def test_rejects_file_input_and_same_directory_output(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source_file = directory / "input.csv"
            source_file.write_text("ID\n1\n", encoding="utf-8")

            with self.assertRaisesRegex(CsvShapeError, "input must be a directory"):
                preflight_csv_batch(source_file, directory / "report.md")

            with self.assertRaisesRegex(CsvShapeError, "must be different paths"):
                preflight_csv_batch(directory, directory)


if __name__ == "__main__":
    unittest.main()
