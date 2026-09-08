import tempfile
import unittest
from pathlib import Path

from data_shape_kit.clean import CsvShapeError
from data_shape_kit.sitemap_preflight import (
    MAX_SITEMAP_BYTES,
    SitemapFinding,
    SitemapPreflightReport,
    preflight_sitemap,
)


NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9"


class SitemapPreflightTests(unittest.TestCase):
    def test_accepts_supported_urlset_values(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "sitemap.xml"
            target = directory / "preflight.md"
            source.write_text(
                '<?xml version="1.0" encoding="UTF-8"?>\n'
                f'<urlset xmlns="{NAMESPACE}">\n'
                "  <url><loc>https://example.com/</loc><lastmod>2026-09-01</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>\n"
                "  <url><loc>https://example.com/catalog</loc><lastmod>2026-09-02T10:15:30+00:00</lastmod></url>\n"
                "</urlset>\n",
                encoding="utf-8",
            )

            report = preflight_sitemap(source, target)

            self.assertEqual(
                report,
                SitemapPreflightReport(
                    input_rows=2,
                    root_kind="urlset",
                    findings=(),
                ),
            )
            output = target.read_text(encoding="utf-8")
            self.assertIn("No findings from the supported local checks.", output)
            self.assertIn("does not include source URL values", output)

    def test_accepts_supported_sitemap_index(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "sitemap-index.xml"
            target = directory / "preflight.md"
            source.write_text(
                f'<sitemapindex xmlns="{NAMESPACE}">'
                "<sitemap><loc>https://example.com/one.xml</loc><lastmod>2026-09-01</lastmod></sitemap>"
                "<sitemap><loc>https://example.com/two.xml.gz</loc></sitemap>"
                "</sitemapindex>",
                encoding="utf-8",
            )

            report = preflight_sitemap(source, target)

            self.assertEqual(report.input_rows, 2)
            self.assertEqual(report.root_kind, "sitemapindex")
            self.assertEqual(report.findings, ())

    def test_reports_entry_findings_without_source_urls(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "sitemap.xml"
            target = directory / "preflight.md"
            source.write_text(
                f'<urlset xmlns="{NAMESPACE}">'
                "<url><loc>https://private.example/one</loc><lastmod>not-a-date</lastmod><changefreq>sometimes</changefreq><priority>2</priority></url>"
                "<url><loc>https://private.example/one</loc></url>"
                "<url></url>"
                "<url><loc>private-relative-path</loc></url>"
                "<url><loc>https://other-private.example/five</loc></url>"
                "</urlset>",
                encoding="utf-8",
            )

            report = preflight_sitemap(source, target)

            self.assertEqual(
                report.findings,
                (
                    SitemapFinding("missing_loc", "error", 1, (3,)),
                    SitemapFinding("invalid_loc", "error", 1, (4,)),
                    SitemapFinding("duplicate_loc", "error", 2, (1, 2)),
                    SitemapFinding("multiple_origins", "warning", 1, (5,)),
                    SitemapFinding("invalid_lastmod", "error", 1, (1,)),
                    SitemapFinding("invalid_changefreq", "warning", 1, (1,)),
                    SitemapFinding("invalid_priority", "warning", 1, (1,)),
                ),
            )
            output = target.read_text(encoding="utf-8")
            self.assertIn("| missing_loc | error | 1 | 3 |", output)
            self.assertIn("does not guarantee crawling or indexing", output)
            for source_value in (
                "private.example",
                "other-private.example",
                "private-relative-path",
                "not-a-date",
                "sometimes",
            ):
                self.assertNotIn(source_value, output)

    def test_reports_root_namespace_empty_and_entry_limit_findings(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            target = directory / "preflight.md"

            empty = directory / "empty.xml"
            empty.write_text("<urlset></urlset>", encoding="utf-8")
            empty_report = preflight_sitemap(empty, target)
            self.assertEqual(
                empty_report.findings,
                (
                    SitemapFinding("invalid_namespace", "error", 1, ()),
                    SitemapFinding("empty_sitemap", "error", 1, ()),
                ),
            )

            unsupported = directory / "unsupported.xml"
            unsupported.write_text("<private-root></private-root>", encoding="utf-8")
            unsupported_report = preflight_sitemap(unsupported, target)
            self.assertEqual(unsupported_report.root_kind, "unsupported")
            self.assertEqual(
                unsupported_report.findings,
                (SitemapFinding("invalid_root", "error", 1, ()),),
            )
            self.assertNotIn("private-root", target.read_text(encoding="utf-8"))

            wrong_entry_namespace = directory / "wrong-entry-namespace.xml"
            wrong_entry_namespace.write_text(
                f'<urlset xmlns="{NAMESPACE}">'
                '<url xmlns=""><loc>https://example.com/</loc></url>'
                "</urlset>",
                encoding="utf-8",
            )
            namespace_report = preflight_sitemap(wrong_entry_namespace, target)
            self.assertEqual(
                namespace_report.findings,
                (SitemapFinding("invalid_entry_namespace", "error", 1, (1,)),),
            )

            oversized_entries = directory / "too-many-entries.xml"
            entries = "".join(
                f"<url><loc>https://example.com/{index}</loc></url>"
                for index in range(50_001)
            )
            oversized_entries.write_text(
                f'<urlset xmlns="{NAMESPACE}">{entries}</urlset>',
                encoding="utf-8",
            )
            limit_report = preflight_sitemap(oversized_entries, target)
            self.assertEqual(limit_report.input_rows, 50_001)
            self.assertEqual(
                limit_report.findings,
                (SitemapFinding("too_many_entries", "error", 1, ()),),
            )

    def test_rejects_unsafe_or_unreadable_input_without_output(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            target = directory / "preflight.md"

            for filename, content, message in (
                (
                    "doctype.xml",
                    '<!DOCTYPE urlset [<!ENTITY private "value">]><urlset></urlset>',
                    "DTD and entity declarations",
                ),
                ("malformed.xml", "<urlset><url></urlset>", "invalid XML sitemap"),
            ):
                with self.subTest(filename=filename):
                    source = directory / filename
                    source.write_text(content, encoding="utf-8")
                    with self.assertRaisesRegex(CsvShapeError, message):
                        preflight_sitemap(source, target)
                    self.assertFalse(target.exists())

            bad_encoding = directory / "bad-encoding.xml"
            bad_encoding.write_bytes(b"<urlset>\xff</urlset>")
            with self.assertRaisesRegex(CsvShapeError, "expected a UTF-8"):
                preflight_sitemap(bad_encoding, target)
            self.assertFalse(target.exists())

            too_large = directory / "too-large.xml"
            with too_large.open("wb") as handle:
                handle.truncate(MAX_SITEMAP_BYTES + 1)
            with self.assertRaisesRegex(CsvShapeError, "50 MB"):
                preflight_sitemap(too_large, target)
            self.assertFalse(target.exists())

            valid = directory / "valid.xml"
            valid.write_text(f'<urlset xmlns="{NAMESPACE}"/>', encoding="utf-8")
            with self.assertRaisesRegex(CsvShapeError, "must be different files"):
                preflight_sitemap(valid, valid)


if __name__ == "__main__":
    unittest.main()
