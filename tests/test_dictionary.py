import tempfile
import unittest
from pathlib import Path

from data_shape_kit.clean import CsvShapeError
from data_shape_kit.dictionary import (
    ColumnDictionary,
    DictionaryReport,
    write_dictionary,
)


class DictionaryTests(unittest.TestCase):
    def test_writes_aggregate_markdown_without_source_values(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "input.csv"
            target = directory / "dictionary.md"
            source.write_text(
                " Order ID ,Active,Amount,Due Date,Updated At,Note|Text,Mixed\n"
                "1,true,10.50,2026-09-01,2026-09-01T12:30:00,secret alpha,3\n"
                "2,false,-2.00,2026-09-02,2026-09-02T01:02:03Z,secret beta,word\n"
                ",,0.25,,,secret alpha,\n",
                encoding="utf-8",
            )

            report = write_dictionary(source, target)

            self.assertEqual(
                report,
                DictionaryReport(
                    input_rows=3,
                    input_columns=7,
                    columns=(
                        ColumnDictionary("order_id", 1, 2, 1, 2, "integer"),
                        ColumnDictionary("active", 2, 2, 1, 2, "boolean"),
                        ColumnDictionary("amount", 3, 3, 0, 3, "decimal"),
                        ColumnDictionary("due_date", 4, 2, 1, 2, "date"),
                        ColumnDictionary("updated_at", 5, 2, 1, 2, "datetime"),
                        ColumnDictionary("note_text", 6, 3, 0, 2, "text"),
                        ColumnDictionary("mixed", 7, 2, 1, 2, "mixed"),
                    ),
                ),
            )
            output = target.read_text(encoding="utf-8")
            self.assertEqual(
                output,
                "# CSV data dictionary\n\n"
                "- Rows: 3\n"
                "- Columns: 7\n\n"
                "| Position | Field | Observed kind | Non-empty | Empty | Distinct non-empty |\n"
                "| ---: | --- | --- | ---: | ---: | ---: |\n"
                "| 1 | order_id | integer | 2 | 1 | 2 |\n"
                "| 2 | active | boolean | 2 | 1 | 2 |\n"
                "| 3 | amount | decimal | 3 | 0 | 3 |\n"
                "| 4 | due_date | date | 2 | 1 | 2 |\n"
                "| 5 | updated_at | datetime | 2 | 1 | 2 |\n"
                "| 6 | note_text | text | 3 | 0 | 2 |\n"
                "| 7 | mixed | mixed | 2 | 1 | 2 |\n",
            )
            for source_value in (
                "secret alpha",
                "secret beta",
                "2026-09-01",
                "10.50",
                "word",
            ):
                self.assertNotIn(source_value, output)

    def test_header_only_input_reports_empty_kinds(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "input.csv"
            target = directory / "dictionary.md"
            source.write_text("Name,Region\n", encoding="utf-8")

            report = write_dictionary(source, target)

            self.assertEqual(
                report.columns,
                (
                    ColumnDictionary("name", 1, 0, 0, 0, "empty"),
                    ColumnDictionary("region", 2, 0, 0, 0, "empty"),
                ),
            )
            self.assertIn("| 1 | name | empty | 0 | 0 | 0 |", target.read_text())

    def test_malformed_row_does_not_create_output(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "input.csv"
            target = directory / "dictionary.md"
            source.write_text("Name,Region\nAda,EU,extra\n", encoding="utf-8")

            with self.assertRaisesRegex(CsvShapeError, "line 2 has 3 columns; expected 2"):
                write_dictionary(source, target)

            self.assertFalse(target.exists())

    def test_rejects_same_input_and_output_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "input.csv"
            source.write_text("Name\nAda\n", encoding="utf-8")

            with self.assertRaisesRegex(CsvShapeError, "must be different files"):
                write_dictionary(source, source)

            self.assertEqual(source.read_text(encoding="utf-8"), "Name\nAda\n")


if __name__ == "__main__":
    unittest.main()
