import tempfile
import unittest
from pathlib import Path

from data_shape_kit.clean import CsvShapeError
from data_shape_kit.compare import (
    ComparisonFinding,
    CsvComparisonReport,
    compare_csvs,
)


class CsvComparisonTests(unittest.TestCase):
    def test_reports_schema_and_row_differences_without_source_values(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            old = directory / "private-old.csv"
            new = directory / "private-new.csv"
            target = directory / "comparison.md"
            old.write_text(
                "SKU,Title,Qty,OldOnly\n"
                "secret-same,Alpha,1,old-a\n"
                "secret-change,Alpha,1,old-b\n"
                "secret-old,Old item,2,old-c\n"
                ",Missing old key,1,old-d\n"
                "secret-duplicate,Dup A,1,old-e\n"
                "secret-duplicate,Dup B,2,old-f\n",
                encoding="utf-8",
            )
            new.write_text(
                "Title,SKU,Qty,NewOnly\n"
                "Alpha,secret-same,1,new-a\n"
                "Changed,secret-change,1,new-b\n"
                "New item,secret-new,3,new-c\n"
                "Missing new key,,4,new-d\n"
                "Dup A,secret-duplicate,1,new-e\n"
                "Dup B,secret-duplicate,2,new-f\n",
                encoding="utf-8",
            )

            report = compare_csvs(old, new, "SKU", target)

            self.assertEqual(
                report,
                CsvComparisonReport(
                    old_rows=6,
                    new_rows=6,
                    old_columns=4,
                    new_columns=4,
                    matched_unchanged=1,
                    findings=(
                        ComparisonFinding("added_columns", "warning", 1),
                        ComparisonFinding("removed_columns", "warning", 1),
                        ComparisonFinding("reordered_common_columns", "warning", 2),
                        ComparisonFinding(
                            "missing_key_old", "error", 1, old_rows=(5,)
                        ),
                        ComparisonFinding(
                            "missing_key_new", "error", 1, new_rows=(5,)
                        ),
                        ComparisonFinding(
                            "duplicate_key_old", "error", 2, old_rows=(6, 7)
                        ),
                        ComparisonFinding(
                            "duplicate_key_new", "error", 2, new_rows=(6, 7)
                        ),
                        ComparisonFinding("only_old", "warning", 1, old_rows=(4,)),
                        ComparisonFinding("only_new", "warning", 1, new_rows=(4,)),
                        ComparisonFinding(
                            "changed_record",
                            "warning",
                            1,
                            old_rows=(3,),
                            new_rows=(3,),
                        ),
                    ),
                ),
            )
            output = target.read_text(encoding="utf-8")
            self.assertIn("# CSV comparison report", output)
            self.assertIn("| changed_record | warning | 1 | 3 | 3 |", output)
            self.assertIn("Matched unchanged rows: 1", output)
            for private_value in (
                "SKU",
                "Title",
                "OldOnly",
                "NewOnly",
                "secret-same",
                "secret-change",
                "secret-old",
                "secret-new",
                "secret-duplicate",
                "private-old.csv",
                "private-new.csv",
            ):
                self.assertNotIn(private_value, output)

    def test_equal_files_produce_no_findings(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            old = directory / "old.csv"
            new = directory / "new.csv"
            target = directory / "comparison.md"
            content = "Record ID,Label\nprivate-1,Private label\n"
            old.write_text(content, encoding="utf-8")
            new.write_text(content, encoding="utf-8")

            report = compare_csvs(old, new, "Record ID", target)

            self.assertEqual(report.findings, ())
            self.assertEqual(report.matched_unchanged, 1)
            output = target.read_text(encoding="utf-8")
            self.assertIn("No differences from the supported exact comparison.", output)
            self.assertNotIn("Record ID", output)
            self.assertNotIn("private-1", output)
            self.assertNotIn("Private label", output)

    def test_duplicate_key_on_one_side_is_not_reported_as_only_on_other_side(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            old = directory / "old.csv"
            new = directory / "new.csv"
            target = directory / "comparison.md"
            old.write_text("ID,Value\ndup,one\ndup,two\n", encoding="utf-8")
            new.write_text("ID,Value\ndup,three\n", encoding="utf-8")

            report = compare_csvs(old, new, "ID", target)

            self.assertEqual(
                report.findings,
                (ComparisonFinding("duplicate_key_old", "error", 2, old_rows=(2, 3)),),
            )

    def test_rejects_missing_or_ambiguous_exact_key_without_output(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            old = directory / "old.csv"
            new = directory / "new.csv"
            target = directory / "comparison.md"
            old.write_text("ID,Value\n1,a\n", encoding="utf-8")
            new.write_text("id,Value\n1,a\n", encoding="utf-8")

            with self.assertRaisesRegex(
                CsvShapeError, "comparison key must appear exactly once in both files"
            ):
                compare_csvs(old, new, "ID", target)
            self.assertFalse(target.exists())

            new.write_text("ID,ID\n1,1\n", encoding="utf-8")
            with self.assertRaisesRegex(
                CsvShapeError, "comparison key must appear exactly once in both files"
            ):
                compare_csvs(old, new, "ID", target)
            self.assertFalse(target.exists())

    def test_rejects_duplicate_headers_or_malformed_rows_without_output(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            old = directory / "old.csv"
            new = directory / "new.csv"
            target = directory / "comparison.md"
            old.write_text("ID,Value,Value\n1,a,a\n", encoding="utf-8")
            new.write_text("ID,Value\n1,a\n", encoding="utf-8")

            with self.assertRaisesRegex(CsvShapeError, "headers must be unique"):
                compare_csvs(old, new, "ID", target)
            self.assertFalse(target.exists())

            old.write_text("ID,Value\n1,a,extra\n", encoding="utf-8")
            with self.assertRaisesRegex(
                CsvShapeError, "old file line 2 has 3 columns; expected 2"
            ):
                compare_csvs(old, new, "ID", target)
            self.assertFalse(target.exists())

    def test_requires_three_distinct_paths(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            old = directory / "old.csv"
            new = directory / "new.csv"
            target = directory / "comparison.md"
            old.write_text("ID\n1\n", encoding="utf-8")
            new.write_text("ID\n1\n", encoding="utf-8")

            for first, second, output in (
                (old, old, target),
                (old, new, old),
                (old, new, new),
            ):
                with self.subTest(first=first, second=second, output=output):
                    with self.assertRaisesRegex(
                        CsvShapeError, "old, new, and output must be different files"
                    ):
                        compare_csvs(first, second, "ID", output)


if __name__ == "__main__":
    unittest.main()
