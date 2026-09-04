import tempfile
import unittest
from pathlib import Path

from data_shape_kit.clean import CsvShapeError
from data_shape_kit.shopify_preflight import (
    Finding,
    ShopifyPreflightReport,
    preflight_shopify_csv,
)


class ShopifyPreflightTests(unittest.TestCase):
    def test_reports_aggregate_findings_without_product_values(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "products.csv"
            target = directory / "preflight.md"
            source.write_text(
                "Title,URL handle,SKU\n"
                "Private Alpha,good-one,private-sku-1\n"
                "Private Beta,bad handle,private-sku-2\n"
                "Private Gamma,good-two,private-sku-3\n"
                "Private Delta,good-one,private-sku-4\n",
                encoding="utf-8",
            )

            report = preflight_shopify_csv(source, target)

            self.assertEqual(
                report,
                ShopifyPreflightReport(
                    input_rows=4,
                    input_columns=3,
                    findings=(
                        Finding("invalid_handle_format", "error", 1, (3,)),
                        Finding("non_contiguous_handle_group", "warning", 1, (5,)),
                        Finding(
                            "variant_fields_without_option1_headers",
                            "error",
                            4,
                            (2, 3, 4, 5),
                        ),
                    ),
                ),
            )
            output = target.read_text(encoding="utf-8")
            self.assertEqual(
                output,
                "# Shopify product CSV preflight\n\n"
                "- Rows: 4\n"
                "- Columns: 3\n"
                "- Findings: 3\n\n"
                "| Check | Severity | Count | Rows |\n"
                "| --- | --- | ---: | --- |\n"
                "| invalid_handle_format | error | 1 | 3 |\n"
                "| non_contiguous_handle_group | warning | 1 | 5 |\n"
                "| variant_fields_without_option1_headers | error | 4 | 2, 3, 4, 5 |\n\n"
                "This report covers supported local checks only and does not guarantee import acceptance.\n",
            )
            for source_value in (
                "Private Alpha",
                "Private Beta",
                "bad handle",
                "good-one",
                "private-sku-1",
            ):
                self.assertNotIn(source_value, output)

    def test_accepts_current_headers_and_contiguous_variant_rows(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "products.csv"
            target = directory / "preflight.md"
            source.write_text(
                "Title,URL handle,Option1 name,Option1 value,SKU\n"
                "Product,good-one,Size,S,sku-one\n"
                ",good-one,Size,M,sku-two\n"
                "Other,good-two,Title,Default Title,sku-three\n",
                encoding="utf-8",
            )

            report = preflight_shopify_csv(source, target)

            self.assertEqual(report.findings, ())
            self.assertIn(
                "No findings from the supported local checks.",
                target.read_text(encoding="utf-8"),
            )

    def test_accepts_legacy_headers(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "products.csv"
            target = directory / "preflight.md"
            source.write_text(
                "Title,Handle,Option1 Name,Option1 Value,Variant SKU\n"
                "Product,good-one,Size,S,sku-one\n",
                encoding="utf-8",
            )

            report = preflight_shopify_csv(source, target)

            self.assertEqual(report.findings, ())

    def test_reports_missing_exact_title_and_handle_headers(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "products.csv"
            target = directory / "preflight.md"
            source.write_text("title,Vendor\nExample,Example Vendor\n", encoding="utf-8")

            report = preflight_shopify_csv(source, target)

            self.assertEqual(
                report.findings,
                (
                    Finding("missing_title_header", "error", 1, ()),
                    Finding("missing_handle_header", "warning", 1, ()),
                ),
            )
            output = target.read_text(encoding="utf-8")
            self.assertNotIn("Example Vendor", output)

    def test_malformed_row_does_not_create_output(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "products.csv"
            target = directory / "preflight.md"
            source.write_text("Title,URL handle\nProduct,good,extra\n", encoding="utf-8")

            with self.assertRaisesRegex(CsvShapeError, "line 2 has 3 columns; expected 2"):
                preflight_shopify_csv(source, target)

            self.assertFalse(target.exists())

    def test_rejects_same_input_and_output_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "products.csv"
            source.write_text("Title\nProduct\n", encoding="utf-8")

            with self.assertRaisesRegex(CsvShapeError, "must be different files"):
                preflight_shopify_csv(source, source)

            self.assertEqual(source.read_text(encoding="utf-8"), "Title\nProduct\n")


if __name__ == "__main__":
    unittest.main()
