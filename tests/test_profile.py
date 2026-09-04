import json
import tempfile
import unittest
from pathlib import Path

from data_shape_kit.clean import CsvShapeError
from data_shape_kit.profile import ColumnProfile, ProfileReport, profile_csv


class ProfileCsvTests(unittest.TestCase):
    def test_counts_empty_and_distinct_values_without_emitting_values(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "input.csv"
            target = directory / "profile.json"
            source.write_text(
                " Customer ID ,Region,Region\n"
                "secret_alpha,North,\n"
                "secret_beta, North ,West\n"
                ",,West\n",
                encoding="utf-8",
            )

            report = profile_csv(source, target)

            self.assertEqual(
                report,
                ProfileReport(
                    input_rows=3,
                    input_columns=3,
                    columns=(
                        ColumnProfile("customer_id", empty=1, distinct_non_empty=2),
                        ColumnProfile("region", empty=1, distinct_non_empty=1),
                        ColumnProfile("region_2", empty=1, distinct_non_empty=1),
                    ),
                ),
            )
            output_text = target.read_text(encoding="utf-8")
            self.assertEqual(
                json.loads(output_text),
                {
                    "columns": [
                        {"distinct_non_empty": 2, "empty": 1, "name": "customer_id"},
                        {"distinct_non_empty": 1, "empty": 1, "name": "region"},
                        {"distinct_non_empty": 1, "empty": 1, "name": "region_2"},
                    ],
                    "input_columns": 3,
                    "input_rows": 3,
                },
            )
            self.assertTrue(output_text.endswith("\n"))
            for source_value in ("secret_alpha", "secret_beta", "North", "West"):
                self.assertNotIn(source_value, output_text)

    def test_malformed_row_does_not_create_output(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "input.csv"
            target = directory / "profile.json"
            source.write_text("Name,Region\nAda,EU,extra\n", encoding="utf-8")

            with self.assertRaisesRegex(CsvShapeError, "line 2 has 3 columns; expected 2"):
                profile_csv(source, target)

            self.assertFalse(target.exists())

    def test_rejects_same_input_and_output_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "input.csv"
            source.write_text("Name\nAda\n", encoding="utf-8")

            with self.assertRaisesRegex(
                CsvShapeError, "input and output must be different files"
            ):
                profile_csv(source, source)

            self.assertEqual(source.read_text(encoding="utf-8"), "Name\nAda\n")


if __name__ == "__main__":
    unittest.main()
