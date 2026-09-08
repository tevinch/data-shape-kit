import tempfile
import unittest
from pathlib import Path

from data_shape_kit.clean import CsvShapeError
from data_shape_kit.ebay_preflight import (
    EbayPreflightReport,
    Finding,
    preflight_ebay_csv,
)


class EbayPreflightTests(unittest.TestCase):
    def test_reports_supported_findings_without_listing_values(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "listings.csv"
            target = directory / "preflight.md"
            source.write_text(
                "Action,Category ID,Title,Relationship,Relationship details,Start price,Quantity,Item photo URL,Custom label (SKU),Condition ID,Description,Format,Duration,Schedule Time\n"
                "Add,not-a-category,,,,$12,0,http://example.test/private image.jpg,private-sku,not-a-condition,,FixedPrice,7,2026/09/09\n",
                encoding="utf-8",
            )

            report = preflight_ebay_csv(source, target)

            self.assertEqual(
                report,
                EbayPreflightReport(
                    input_rows=1,
                    input_columns=14,
                    findings=(
                        Finding("invalid_category_id", "error", 1, (2,)),
                        Finding("missing_title", "error", 1, (2,)),
                        Finding("invalid_start_price", "error", 1, (2,)),
                        Finding("invalid_quantity", "error", 1, (2,)),
                        Finding("invalid_item_photo_url", "error", 1, (2,)),
                        Finding("invalid_condition_id", "error", 1, (2,)),
                        Finding("missing_description", "error", 1, (2,)),
                        Finding("invalid_duration", "error", 1, (2,)),
                        Finding("invalid_schedule_time", "error", 1, (2,)),
                    ),
                ),
            )
            output = target.read_text(encoding="utf-8")
            self.assertIn("# eBay listing file preflight", output)
            self.assertIn("supported local checks only", output)
            self.assertIn("does not guarantee upload acceptance", output)
            for source_value in (
                "not-a-category",
                "private image.jpg",
                "private-sku",
                "not-a-condition",
            ):
                self.assertNotIn(source_value, output)

    def test_accepts_info_row_variations_and_regular_listing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "listings.csv"
            target = directory / "preflight.md"
            source.write_text(
                "#INFO,Version=1\n"
                "Action,Category ID,Title,Relationship,Relationship details,Start price,Quantity,Item photo URL,Custom label (SKU),Condition ID,Description,Format,Duration\n"
                "Add,260955,Private Parent,,Color=Red;Blue|Size=S;M,,,https://example.test/parent.jpg,parent-private,1000,Private description,FixedPrice,GTC\n"
                ",,,Variation,Color=Red|Size=S,3,2,Red=https://example.test/red.jpg,child-private,,,,\n"
                "Add,1245,Private Regular,,,10.00,1,https://example.test/regular.jpg,regular-private,3000,Private regular description,Auction,7\n",
                encoding="utf-8",
            )

            report = preflight_ebay_csv(source, target)

            self.assertEqual(report.input_rows, 3)
            self.assertEqual(report.input_columns, 13)
            self.assertEqual(report.findings, ())
            self.assertIn(
                "No findings from the supported local checks.",
                target.read_text(encoding="utf-8"),
            )

    def test_reports_header_action_sku_and_variation_findings(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "listings.csv"
            target = directory / "preflight.md"
            source.write_text(
                "Action,Category ID,Relationship,Relationship details,Start price,Quantity,Item photo URL,Custom label (SKU),Condition ID,Description,Format,Duration\n"
                "Draft,123,,,,,,shared-private,,,,\n"
                "Revise,123,,,,,,shared-private,,,,\n"
                ",,Variation,Color =Red|Size=S,,0,,,,,,\n",
                encoding="utf-8",
            )

            report = preflight_ebay_csv(source, target)

            self.assertEqual(
                report.findings,
                (
                    Finding("missing_title_header", "error", 1, ()),
                    Finding("unsupported_action", "warning", 1, (3,)),
                    Finding("duplicate_sku", "warning", 1, (3,)),
                    Finding("variation_without_parent", "error", 1, (4,)),
                    Finding("invalid_relationship_details_spacing", "error", 1, (4,)),
                    Finding("invalid_quantity", "error", 1, (4,)),
                    Finding("missing_start_price", "error", 1, (4,)),
                ),
            )

    def test_reports_missing_core_headers(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "listings.csv"
            target = directory / "preflight.md"
            source.write_text("action,category\nAdd,123\n", encoding="utf-8")

            report = preflight_ebay_csv(source, target)

            self.assertEqual(
                report.findings,
                (
                    Finding("missing_action_header", "error", 1, ()),
                    Finding("missing_category_id_header", "error", 1, ()),
                ),
            )

    def test_malformed_row_does_not_create_output(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "listings.csv"
            target = directory / "preflight.md"
            source.write_text("Action,Category ID\nDraft,123,extra\n", encoding="utf-8")

            with self.assertRaisesRegex(CsvShapeError, "line 2 has 3 columns; expected 2"):
                preflight_ebay_csv(source, target)

            self.assertFalse(target.exists())

    def test_rejects_same_input_and_output_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "listings.csv"
            source.write_text("Action,Category ID\nDraft,123\n", encoding="utf-8")

            with self.assertRaisesRegex(CsvShapeError, "must be different files"):
                preflight_ebay_csv(source, source)

            self.assertEqual(
                source.read_text(encoding="utf-8"),
                "Action,Category ID\nDraft,123\n",
            )


if __name__ == "__main__":
    unittest.main()
