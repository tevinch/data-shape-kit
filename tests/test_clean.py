import csv
import tempfile
import unittest
from pathlib import Path

from data_shape_kit.clean import CleanReport, CsvShapeError, clean_csv, normalize_headers


class NormalizeHeadersTests(unittest.TestCase):
    def test_normalizes_and_disambiguates_headers(self) -> None:
        self.assertEqual(
            normalize_headers([" Customer Name ", "Region/Code", "Customer Name", "  "]),
            ["customer_name", "region_code", "customer_name_2", "column_4"],
        )


class CleanCsvTests(unittest.TestCase):
    def write_input(self, directory: Path, content: str) -> Path:
        source = directory / "input.csv"
        source.write_text(content, encoding="utf-8")
        return source

    def test_trims_cells_and_removes_duplicates_after_trimming(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = self.write_input(
                directory,
                " Customer Name , Region/Code ,Status\nAda , EU , active \nAda,EU,active\nLin,APAC, pending\n",
            )
            target = directory / "cleaned.csv"

            report = clean_csv(source, target)

            self.assertEqual(report, CleanReport(3, 2, 1, 3))
            with target.open(newline="", encoding="utf-8") as handle:
                self.assertEqual(
                    list(csv.reader(handle)),
                    [
                        ["customer_name", "region_code", "status"],
                        ["Ada", "EU", "active"],
                        ["Lin", "APAC", "pending"],
                    ],
                )

    def test_header_only_input_writes_header_and_zero_counts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = self.write_input(directory, "Name,Region\n")
            target = directory / "cleaned.csv"

            report = clean_csv(source, target)

            self.assertEqual(report, CleanReport(0, 0, 0, 2))
            self.assertEqual(target.read_text(encoding="utf-8"), "name,region\n")

    def test_empty_input_raises_without_creating_output(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = self.write_input(directory, "")
            target = directory / "cleaned.csv"

            with self.assertRaisesRegex(CsvShapeError, "expected a header row"):
                clean_csv(source, target)

            self.assertFalse(target.exists())

    def test_row_with_wrong_column_count_reports_line_number(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = self.write_input(directory, "Name,Region\nAda,EU,extra\n")
            target = directory / "cleaned.csv"

            with self.assertRaisesRegex(CsvShapeError, "line 2 has 3 columns; expected 2"):
                clean_csv(source, target)

            self.assertFalse(target.exists())

    def test_rejects_same_input_and_output_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = self.write_input(directory, "Name\nAda\n")

            with self.assertRaisesRegex(CsvShapeError, "must be different files"):
                clean_csv(source, source)


if __name__ == "__main__":
    unittest.main()
