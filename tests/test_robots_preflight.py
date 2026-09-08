import tempfile
import unittest
from pathlib import Path

from data_shape_kit.clean import CsvShapeError
from data_shape_kit.robots_preflight import (
    MAX_ROBOTS_BYTES,
    RobotsFinding,
    RobotsPreflightReport,
    preflight_robots,
)


class RobotsPreflightTests(unittest.TestCase):
    def test_accepts_supported_groups_comments_and_sitemap(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "robots.txt"
            target = directory / "preflight.md"
            source.write_text(
                "# public crawl rules\n"
                "User-agent: *\n"
                "Disallow:\n"
                "Allow: /\n"
                "Sitemap: https://example.com/sitemap.xml\n"
                "\n"
                "User-agent: ExampleCrawler\n"
                "Disallow: /temporary/ # public path\n",
                encoding="utf-8",
            )

            report = preflight_robots(source, target)

            self.assertEqual(
                report,
                RobotsPreflightReport(input_rows=8, group_count=2, findings=()),
            )
            output = target.read_text(encoding="utf-8")
            self.assertIn("No findings from the supported local checks.", output)
            self.assertIn("does not include source directive values", output)

    def test_reports_supported_findings_without_directive_values(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "robots.txt"
            target = directory / "preflight.md"
            source.write_text(
                "Disallow: /private-before\n"
                "User-agent: invalid token\n"
                "User-agent: *\n"
                "Disallow: /\n"
                "Disallow: /\n"
                "Allow: /private-same\n"
                "Disallow: /private-same\n"
                "Allow: private-relative\n"
                "Crawl-delay: 10\n"
                "Sitemap: private-relative-map\n"
                "private broken line\n",
                encoding="utf-8",
            )

            report = preflight_robots(source, target)

            self.assertEqual(report.input_rows, 11)
            self.assertEqual(report.group_count, 1)
            self.assertEqual(
                report.findings,
                (
                    RobotsFinding("invalid_line", "error", 1, (11,)),
                    RobotsFinding("invalid_user_agent", "error", 1, (2,)),
                    RobotsFinding("rule_without_user_agent", "error", 1, (1,)),
                    RobotsFinding("invalid_rule_path", "error", 1, (8,)),
                    RobotsFinding("duplicate_rule", "warning", 2, (4, 5)),
                    RobotsFinding("conflicting_rule", "warning", 2, (6, 7)),
                    RobotsFinding("invalid_sitemap", "error", 1, (10,)),
                    RobotsFinding("unsupported_field", "warning", 1, (9,)),
                    RobotsFinding("global_crawl_block", "warning", 1, (4,)),
                ),
            )
            output = target.read_text(encoding="utf-8")
            self.assertIn("| invalid_line | error | 1 | 11 |", output)
            self.assertIn("does not guarantee crawling or indexing", output)
            for source_value in (
                "private-before",
                "invalid token",
                "private-same",
                "private-relative",
                "private-relative-map",
                "Crawl-delay",
            ):
                self.assertNotIn(source_value, output)

    def test_combines_repeated_user_agent_groups_without_flagging_them(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "robots.txt"
            target = directory / "preflight.md"
            source.write_text(
                "\ufeffUser-agent: ExampleCrawler\r\n"
                "Disallow: /one/\r\n"
                "Sitemap: https://example.com/sitemap.xml\r\n"
                "User-agent: examplecrawler\r\n"
                "Allow: /two/\r\n",
                encoding="utf-8",
            )

            report = preflight_robots(source, target)

            self.assertEqual(report.input_rows, 5)
            self.assertEqual(report.group_count, 2)
            self.assertEqual(report.findings, ())

    def test_combines_repeated_wildcard_groups_before_conflict_checks(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "robots.txt"
            target = directory / "preflight.md"
            source.write_text(
                "User-agent: *\n"
                "Disallow: /\n"
                "User-agent: *\n"
                "Allow: /\n",
                encoding="utf-8",
            )

            report = preflight_robots(source, target)

            self.assertEqual(report.group_count, 2)
            self.assertEqual(
                report.findings,
                (RobotsFinding("conflicting_rule", "warning", 2, (2, 4)),),
            )

    def test_accepts_an_empty_file_as_allowing_all(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "robots.txt"
            target = directory / "preflight.md"
            source.write_text("", encoding="utf-8")

            report = preflight_robots(source, target)

            self.assertEqual(
                report,
                RobotsPreflightReport(input_rows=0, group_count=0, findings=()),
            )

    def test_rejects_bad_encoding_oversize_and_same_path_without_output(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            target = directory / "preflight.md"

            bad_encoding = directory / "bad-encoding.txt"
            bad_encoding.write_bytes(b"User-agent: *\nDisallow: /\xff\n")
            with self.assertRaisesRegex(CsvShapeError, "expected a UTF-8"):
                preflight_robots(bad_encoding, target)
            self.assertFalse(target.exists())

            too_large = directory / "too-large.txt"
            with too_large.open("wb") as handle:
                handle.truncate(MAX_ROBOTS_BYTES + 1)
            with self.assertRaisesRegex(CsvShapeError, "500 KiB"):
                preflight_robots(too_large, target)
            self.assertFalse(target.exists())

            valid = directory / "valid.txt"
            valid.write_text("User-agent: *\nDisallow:\n", encoding="utf-8")
            with self.assertRaisesRegex(CsvShapeError, "must be different files"):
                preflight_robots(valid, valid)


if __name__ == "__main__":
    unittest.main()
