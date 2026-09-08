import tempfile
import unittest
from pathlib import Path

from data_shape_kit.clean import CsvShapeError
from data_shape_kit.merchant_feed_preflight import (
    MerchantFeedPreflightReport,
    MerchantFinding,
    preflight_merchant_feed,
)


class MerchantFeedPreflightTests(unittest.TestCase):
    def test_reports_supported_findings_without_product_values(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "products.tsv"
            target = directory / "preflight.md"
            source.write_text(
                "id\ttitle\tdescription\tlink\timage_link\tavailability\tprice\tcondition\tvideo_link\tavailability_date\n"
                "\tPrivate one\tPrivate description\thttps://shop.example/one\thttps://shop.example/one.jpg\tin_stock\t10.00 USD\tnew\t\t\n"
                "duplicate-secret\tPrivate two\tPrivate description\thttps://shop.example/two\thttps://shop.example/two.jpg\tout_of_stock\t20 EUR\tused\t\t\n"
                "duplicate-secret\tPrivate three\tPrivate description\thttps://shop.example/three\thttps://shop.example/three.jpg\tbackorder\t30.50 GBP\trefurbished\t\t\n"
                "private-four\tPrivate four\tPrivate description\tnot-a-public-url\tftp://shop.example/four.jpg\tavailable-now\tfree\tmint\tjavascript:private-video\t\n"
                "private-five\tPrivate five\tPrivate description\thttps://shop.example/five\thttps://shop.example/five.jpg\tpreorder\t50 JPY\tnew\t\t\n",
                encoding="utf-8",
            )

            report = preflight_merchant_feed(source, target)

            self.assertEqual(
                report,
                MerchantFeedPreflightReport(
                    input_rows=5,
                    input_columns=10,
                    findings=(
                        MerchantFinding("missing_id_value", "error", 1, (2,)),
                        MerchantFinding("duplicate_id", "error", 2, (3, 4)),
                        MerchantFinding("invalid_link", "error", 1, (5,)),
                        MerchantFinding("invalid_image_link", "error", 1, (5,)),
                        MerchantFinding("invalid_availability", "error", 1, (5,)),
                        MerchantFinding(
                            "missing_availability_date", "error", 1, (6,)
                        ),
                        MerchantFinding("invalid_price", "error", 1, (5,)),
                        MerchantFinding("invalid_condition", "error", 1, (5,)),
                        MerchantFinding("invalid_video_link", "warning", 1, (5,)),
                    ),
                ),
            )
            output = target.read_text(encoding="utf-8")
            self.assertIn("# Merchant product feed preflight", output)
            self.assertIn("does not include source cell values", output)
            self.assertIn("does not guarantee approval", output)
            for private_value in (
                "Private one",
                "Private description",
                "duplicate-secret",
                "not-a-public-url",
                "ftp://shop.example/four.jpg",
                "available-now",
                "javascript:private-video",
            ):
                self.assertNotIn(private_value, output)

    def test_accepts_structured_text_alternatives_and_supported_values(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "products.txt"
            target = directory / "preflight.md"
            source.write_text(
                "id\tstructured_title\tstructured_description\tlink\timage_link\tavailability\tprice\n"
                "safe-1\tdefault:Product\tdefault:Description\thttps://shop.example/one\thttps://shop.example/one.jpg\tin_stock\t10.00 USD\n",
                encoding="utf-8",
            )

            report = preflight_merchant_feed(source, target)

            self.assertEqual(report.input_rows, 1)
            self.assertEqual(report.input_columns, 7)
            self.assertEqual(report.findings, ())
            self.assertIn(
                "No findings from the supported local checks.",
                target.read_text(encoding="utf-8"),
            )

    def test_reports_missing_exact_core_headers_without_guessing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "products.tsv"
            target = directory / "preflight.md"
            source.write_text("ID\ttitle\nprivate-id\tPrivate title\n", encoding="utf-8")

            report = preflight_merchant_feed(source, target)

            self.assertEqual(
                report.findings,
                (
                    MerchantFinding("missing_id_header", "error", 1, ()),
                    MerchantFinding("missing_description_header", "error", 1, ()),
                    MerchantFinding("missing_link_header", "error", 1, ()),
                    MerchantFinding("missing_image_link_header", "error", 1, ()),
                    MerchantFinding("missing_availability_header", "error", 1, ()),
                    MerchantFinding("missing_price_header", "error", 1, ()),
                ),
            )
            self.assertNotIn("private-id", target.read_text(encoding="utf-8"))

    def test_reports_malformed_row_without_copying_values(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "products.tsv"
            target = directory / "preflight.md"
            source.write_text(
                "id\ttitle\tdescription\tlink\timage_link\tavailability\tprice\n"
                "private-id\tPrivate title\textra\tprivate\tcolumns\tin\tthis\trow\n",
                encoding="utf-8",
            )

            report = preflight_merchant_feed(source, target)

            self.assertEqual(
                report.findings,
                (MerchantFinding("malformed_row", "error", 1, (2,)),),
            )
            output = target.read_text(encoding="utf-8")
            self.assertNotIn("private-id", output)
            self.assertNotIn("Private title", output)

    def test_rejects_bad_encoding_and_same_path_without_output(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "products.tsv"
            target = directory / "preflight.md"
            source.write_bytes(b"id\ttitle\n\xff\tbroken\n")

            with self.assertRaisesRegex(CsvShapeError, "expected a UTF-8"):
                preflight_merchant_feed(source, target)
            self.assertFalse(target.exists())

            valid = directory / "valid.tsv"
            valid.write_text("id\nprivate\n", encoding="utf-8")
            with self.assertRaisesRegex(CsvShapeError, "must be different files"):
                preflight_merchant_feed(valid, valid)


if __name__ == "__main__":
    unittest.main()
