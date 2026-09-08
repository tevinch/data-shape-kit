import tempfile
import unittest
from pathlib import Path

from data_shape_kit.clean import CsvShapeError
from data_shape_kit.json_ld_preflight import (
    MAX_JSON_LD_BYTES,
    JsonLdFinding,
    JsonLdPreflightReport,
    preflight_json_ld,
)


class JsonLdPreflightTests(unittest.TestCase):
    def test_accepts_supported_graph_without_resolving_context(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "page.html"
            target = directory / "preflight.md"
            source.write_text(
                "<!doctype html><html><head>"
                '<script type="application/ld+json;profile=public">'
                "{"
                '"@context":"https://schema.org",'
                '"@graph":['
                '{"@id":"https://example.com/#site","@type":"WebSite"},'
                '{"@id":"https://example.com/#page","@type":["WebPage"]}'
                "]}"
                "</script></head><body></body></html>",
                encoding="utf-8",
            )

            report = preflight_json_ld(source, target)

            self.assertEqual(
                report,
                JsonLdPreflightReport(
                    input_rows=1,
                    object_count=3,
                    findings=(),
                ),
            )
            output = target.read_text(encoding="utf-8")
            self.assertIn("No findings from the supported local checks.", output)
            self.assertIn("does not include source JSON-LD values", output)
            self.assertIn("does not resolve remote contexts", output)

    def test_reports_supported_findings_without_json_ld_values(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "page.html"
            target = directory / "preflight.md"
            duplicate = (
                '{"@context":"https://schema.org","@type":"Thing",'
                '"@id":"https://example.com/private-id","name":"private name"}'
            )
            source.write_text(
                "<html><head>"
                '<script type="application/ld+json">   </script>'
                '<script type="application/ld+json">'
                '{"private broken":}</script>'
                '<script type="application/ld+json">'
                '"private scalar"</script>'
                '<script type="application/ld+json">'
                '{"@context":42,"@type":["Thing",7],"@id":7,'
                '"@graph":"private graph","name":"secret",'
                '"name":"private duplicate"}</script>'
                f'<script type="application/ld+json">{duplicate}</script>'
                f'<script type="application/ld+json">{duplicate}</script>'
                '<script type="application/ld+json">'
                '{"@context":"https://schema.org","@graph":['
                '{"@id":"https://example.com/shared-id","name":"private one"},'
                '{"@id":"https://example.com/shared-id","@type":"Thing",'
                '"name":"private two"}]}</script>'
                "</head></html>",
                encoding="utf-8",
            )

            report = preflight_json_ld(source, target)

            self.assertEqual(report.input_rows, 7)
            self.assertEqual(report.object_count, 6)
            self.assertEqual(
                report.findings,
                (
                    JsonLdFinding("empty_json_ld_script", "error", 1, ("1",)),
                    JsonLdFinding("invalid_json_syntax", "error", 1, ("2",)),
                    JsonLdFinding("invalid_top_level", "error", 1, ("3",)),
                    JsonLdFinding("duplicate_json_member", "warning", 1, ("4",)),
                    JsonLdFinding("invalid_context_shape", "error", 1, ("4.1",)),
                    JsonLdFinding("invalid_type_shape", "error", 1, ("4.1",)),
                    JsonLdFinding("invalid_id_shape", "error", 1, ("4.1",)),
                    JsonLdFinding("invalid_graph_shape", "error", 1, ("4.1",)),
                    JsonLdFinding(
                        "duplicate_json_ld_block", "warning", 2, ("5", "6")
                    ),
                    JsonLdFinding("missing_type", "warning", 1, ("7.2",)),
                    JsonLdFinding(
                        "repeated_id", "warning", 2, ("7.2", "7.3")
                    ),
                ),
            )
            output = target.read_text(encoding="utf-8")
            self.assertIn(
                "| duplicate_json_ld_block | warning | 2 | 5, 6 |", output
            )
            self.assertIn("does not guarantee rich-result eligibility", output)
            for source_value in (
                "private broken",
                "private scalar",
                "private graph",
                "secret",
                "private duplicate",
                "private-id",
                "private name",
                "shared-id",
                "private one",
                "private two",
            ):
                self.assertNotIn(source_value, output)

    def test_reports_missing_script_and_missing_context(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            target = directory / "preflight.md"

            no_script = directory / "no-script.html"
            no_script.write_text("<html><head></head></html>", encoding="utf-8")
            report = preflight_json_ld(no_script, target)
            self.assertEqual(
                report.findings,
                (JsonLdFinding("missing_json_ld_script", "error", 1, ()),),
            )

            no_context = directory / "no-context.html"
            no_context.write_text(
                '<script type="APPLICATION/LD+JSON">'
                '{"@type":"Thing"}</script>',
                encoding="utf-8",
            )
            report = preflight_json_ld(no_context, target)
            self.assertEqual(
                report.findings,
                (JsonLdFinding("missing_context", "warning", 1, ("1.1",)),),
            )

    def test_distinct_blocks_and_reused_ids_in_one_node_are_supported(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "page.html"
            target = directory / "preflight.md"
            source.write_text(
                "<html><body>"
                '<script type="application/ld+json">'
                '{"@context":"https://schema.org","@type":"Article",'
                '"@id":"https://example.com/a"}</script>'
                '<script type="application/ld+json">'
                '[{"@context":"https://schema.org","@type":"BreadcrumbList",'
                '"@id":"https://example.com/b"}]</script>'
                "</body></html>",
                encoding="utf-8",
            )

            report = preflight_json_ld(source, target)

            self.assertEqual(report.input_rows, 2)
            self.assertEqual(report.object_count, 2)
            self.assertEqual(report.findings, ())

    def test_locations_follow_depth_first_object_numbering(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "page.html"
            target = directory / "preflight.md"
            source.write_text(
                '<script type="application/ld+json">['
                '{"@context":"https://schema.org","@graph":'
                '[{"@type":"Thing"}]},'
                '{"@type":"Article"}]</script>',
                encoding="utf-8",
            )

            report = preflight_json_ld(source, target)

            self.assertEqual(report.object_count, 3)
            self.assertEqual(
                report.findings,
                (JsonLdFinding("missing_context", "warning", 1, ("1.3",)),),
            )

    def test_rejects_unreadable_oversize_control_byte_and_same_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            target = directory / "preflight.md"

            bad_encoding = directory / "bad-encoding.html"
            bad_encoding.write_bytes(b"<html>\xff</html>")
            with self.assertRaisesRegex(CsvShapeError, "expected UTF-8"):
                preflight_json_ld(bad_encoding, target)
            self.assertFalse(target.exists())

            control_byte = directory / "control-byte.html"
            control_byte.write_text("<html>\x00</html>", encoding="utf-8")
            with self.assertRaisesRegex(CsvShapeError, "control bytes"):
                preflight_json_ld(control_byte, target)
            self.assertFalse(target.exists())

            too_large = directory / "too-large.html"
            with too_large.open("wb") as handle:
                handle.truncate(MAX_JSON_LD_BYTES + 1)
            with self.assertRaisesRegex(CsvShapeError, "10 MB"):
                preflight_json_ld(too_large, target)
            self.assertFalse(target.exists())

            valid = directory / "valid.html"
            valid.write_text("<html></html>", encoding="utf-8")
            with self.assertRaisesRegex(CsvShapeError, "must be different files"):
                preflight_json_ld(valid, valid)


if __name__ == "__main__":
    unittest.main()
