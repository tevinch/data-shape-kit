import tempfile
import unittest
from pathlib import Path

from data_shape_kit.clean import CsvShapeError
from data_shape_kit.social_card_preflight import (
    MAX_SOCIAL_CARD_BYTES,
    SocialCardFinding,
    SocialCardPreflightReport,
    preflight_social_card,
)


class SocialCardPreflightTests(unittest.TestCase):
    def test_accepts_supported_public_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "page.html"
            target = directory / "preflight.md"
            source.write_text(
                "<!doctype html><html><head>"
                '<meta charset="utf-8">'
                '<meta property="og:title" content="Public title">'
                '<meta property="og:type" content="article">'
                '<meta property="og:url" content="https://example.com/post">'
                '<meta property="og:image" '
                'content="https://example.com/image.jpg">'
                '<meta property="og:image:alt" content="Public image">'
                '<meta property="og:image:width" content="1200">'
                '<meta property="og:image:height" content="630">'
                '<meta property="og:description" content="Public summary">'
                "</head><body></body></html>",
                encoding="utf-8",
            )

            report = preflight_social_card(source, target)

            self.assertEqual(
                report,
                SocialCardPreflightReport(input_rows=9, findings=()),
            )
            output = target.read_text(encoding="utf-8")
            self.assertIn("No findings from the supported local checks.", output)
            self.assertIn("does not include source metadata values", output)

    def test_reports_supported_findings_without_metadata_values(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "page.html"
            target = directory / "preflight.md"
            source.write_text(
                "<html><head>"
                '<meta property="og:title" content="">'
                '<meta property="og:type" content="website">'
                '<meta property="og:type" content="article">'
                '<meta property="og:image" content="private-relative-image">'
                '<meta property="og:image" '
                'content="https://example.com/shared.jpg">'
                '<meta property="og:image" '
                'content="https://example.com/shared.jpg">'
                '<meta property="og:url" content="private-relative-page">'
                '<meta property="og:image:width" content="-1">'
                '<meta property="og:image:height" content="private-height">'
                "</head><body>"
                '<meta property="og:title" content="private-outside">'
                "</body></html>",
                encoding="utf-8",
            )

            report = preflight_social_card(source, target)

            self.assertEqual(report.input_rows, 10)
            self.assertEqual(
                report.findings,
                (
                    SocialCardFinding("missing_og_description", "warning", 1, ()),
                    SocialCardFinding("empty_og_title", "error", 1, (1,)),
                    SocialCardFinding("multiple_og_type", "warning", 2, (2, 3)),
                    SocialCardFinding("invalid_og_image_url", "error", 1, (4,)),
                    SocialCardFinding("invalid_og_url", "error", 1, (7,)),
                    SocialCardFinding("duplicate_og_image", "warning", 2, (5, 6)),
                    SocialCardFinding(
                        "missing_og_image_alt", "warning", 1, ()
                    ),
                    SocialCardFinding(
                        "invalid_og_image_width", "warning", 1, (8,)
                    ),
                    SocialCardFinding(
                        "invalid_og_image_height", "warning", 1, (9,)
                    ),
                    SocialCardFinding(
                        "og_metadata_outside_head", "warning", 1, (10,)
                    ),
                ),
            )
            output = target.read_text(encoding="utf-8")
            self.assertIn("| duplicate_og_image | warning | 2 | 5, 6 |", output)
            self.assertIn("does not guarantee a preview", output)
            for source_value in (
                "private-relative-image",
                "private-relative-page",
                "private-height",
                "private-outside",
                "shared.jpg",
                "website",
            ):
                self.assertNotIn(source_value, output)

    def test_reports_missing_required_properties(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "page.html"
            target = directory / "preflight.md"
            source.write_text(
                "<!doctype html><html><head><title>Public</title></head></html>",
                encoding="utf-8",
            )

            report = preflight_social_card(source, target)

            self.assertEqual(
                report.findings,
                (
                    SocialCardFinding("missing_og_title", "error", 1, ()),
                    SocialCardFinding("missing_og_type", "error", 1, ()),
                    SocialCardFinding("missing_og_image", "error", 1, ()),
                    SocialCardFinding("missing_og_url", "error", 1, ()),
                    SocialCardFinding("missing_og_description", "warning", 1, ()),
                ),
            )

    def test_multiple_images_are_allowed_when_values_are_distinct(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "page.html"
            target = directory / "preflight.md"
            source.write_text(
                "<html><head>"
                '<meta property="og:title" content="x">'
                '<meta property="og:type" content="article">'
                '<meta property="og:url" content="https://example.com/post">'
                '<meta property="og:image" content="https://example.com/a.jpg">'
                '<meta property="og:image" content="https://example.com/b.jpg">'
                '<meta property="og:image:alt" content="images">'
                '<meta property="og:description" content="x">'
                "</head></html>",
                encoding="utf-8",
            )

            report = preflight_social_card(source, target)

            self.assertEqual(report.findings, ())

    def test_rejects_unreadable_oversize_control_byte_and_same_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            target = directory / "preflight.md"

            bad_encoding = directory / "bad-encoding.html"
            bad_encoding.write_bytes(b"<html>\xff</html>")
            with self.assertRaisesRegex(CsvShapeError, "expected UTF-8"):
                preflight_social_card(bad_encoding, target)
            self.assertFalse(target.exists())

            control_byte = directory / "control-byte.html"
            control_byte.write_text("<html>\x00</html>", encoding="utf-8")
            with self.assertRaisesRegex(CsvShapeError, "control bytes"):
                preflight_social_card(control_byte, target)
            self.assertFalse(target.exists())

            too_large = directory / "too-large.html"
            with too_large.open("wb") as handle:
                handle.truncate(MAX_SOCIAL_CARD_BYTES + 1)
            with self.assertRaisesRegex(CsvShapeError, "10 MB"):
                preflight_social_card(too_large, target)
            self.assertFalse(target.exists())

            valid = directory / "valid.html"
            valid.write_text("<html></html>", encoding="utf-8")
            with self.assertRaisesRegex(CsvShapeError, "must be different files"):
                preflight_social_card(valid, valid)


if __name__ == "__main__":
    unittest.main()
