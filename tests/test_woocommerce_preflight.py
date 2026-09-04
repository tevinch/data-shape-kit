import tempfile
import unittest
from pathlib import Path

from data_shape_kit.clean import CsvShapeError
from data_shape_kit.woocommerce_preflight import (
    Finding,
    WooCommercePreflightReport,
    preflight_woocommerce_csv,
)


class WooCommercePreflightTests(unittest.TestCase):
    def test_reports_supported_findings_without_product_values(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "products.csv"
            target = directory / "preflight.md"
            source.write_text(
                "Type,SKU,Published,Parent,Attribute 1 name\n"
                "simple,secret-sku,1,,Private Color\n"
                "SIMPLE,secret-sku,TRUE,,Private Size\n"
                "variation,variation-secret,0,,Private Material\n",
                encoding="utf-8",
            )

            report = preflight_woocommerce_csv(source, target)

            self.assertEqual(
                report,
                WooCommercePreflightReport(
                    input_rows=3,
                    input_columns=5,
                    findings=(
                        Finding("missing_name_header", "warning", 1, ()),
                        Finding("invalid_type", "error", 1, (3,)),
                        Finding("invalid_published_value", "error", 1, (3,)),
                        Finding("duplicate_sku", "warning", 1, (3,)),
                        Finding("variation_without_parent", "error", 1, (4,)),
                        Finding(
                            "attribute_columns_not_paired", "error", 3, (2, 3, 4)
                        ),
                    ),
                ),
            )
            output = target.read_text(encoding="utf-8")
            self.assertIn("# WooCommerce product CSV preflight", output)
            self.assertIn("supported local checks only", output)
            self.assertIn("does not guarantee import acceptance", output)
            for source_value in (
                "secret-sku",
                "variation-secret",
                "SIMPLE",
                "Private Color",
            ):
                self.assertNotIn(source_value, output)

    def test_accepts_supported_schema_values_and_paired_attributes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "products.csv"
            target = directory / "preflight.md"
            source.write_text(
                "Name,Type,SKU,Published,Parent,Attribute 1 name,Attribute 1 value(s)\n"
                "Parent,variable,parent-sku,1,,Color,Blue Red\n"
                "Child,variation,child-sku,false,parent-sku,Color,Blue\n"
                'Download,"simple, downloadable",download-sku,2,,Format,PDF\n',
                encoding="utf-8",
            )

            report = preflight_woocommerce_csv(source, target)

            self.assertEqual(report.findings, ())
            self.assertIn(
                "No findings from the supported local checks.",
                target.read_text(encoding="utf-8"),
            )

    def test_header_only_file_reports_missing_exact_name_header(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "products.csv"
            target = directory / "preflight.md"
            source.write_text("name,SKU\n", encoding="utf-8")

            report = preflight_woocommerce_csv(source, target)

            self.assertEqual(
                report.findings,
                (Finding("missing_name_header", "warning", 1, ()),),
            )

    def test_malformed_row_does_not_create_output(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "products.csv"
            target = directory / "preflight.md"
            source.write_text("Name,Type\nProduct,simple,extra\n", encoding="utf-8")

            with self.assertRaisesRegex(CsvShapeError, "line 2 has 3 columns; expected 2"):
                preflight_woocommerce_csv(source, target)

            self.assertFalse(target.exists())

    def test_rejects_same_input_and_output_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "products.csv"
            source.write_text("Name\nProduct\n", encoding="utf-8")

            with self.assertRaisesRegex(CsvShapeError, "must be different files"):
                preflight_woocommerce_csv(source, source)


if __name__ == "__main__":
    unittest.main()
