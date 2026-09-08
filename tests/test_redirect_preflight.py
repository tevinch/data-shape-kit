import tempfile
import unittest
from pathlib import Path

from data_shape_kit.clean import CsvShapeError
from data_shape_kit.redirect_preflight import (
    RedirectFinding,
    RedirectPreflightReport,
    preflight_redirect_map,
)


class RedirectPreflightTests(unittest.TestCase):
    def test_reports_mapping_findings_without_url_values(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "private-redirects.csv"
            target = directory / "preflight.md"
            source.write_text(
                "Source URL,Target URL,Status Code\n"
                "https://old.example/a,https://new.example/a,301\n"
                "https://old.example/duplicate,https://new.example/duplicate,301\n"
                "https://old.example/duplicate,https://new.example/duplicate,301\n"
                "https://old.example/conflict,https://new.example/one,301\n"
                "https://old.example/conflict,https://new.example/two,308\n"
                "https://old.example/self,https://old.example/self,301\n"
                "https://old.example/chain-a,https://old.example/chain-b,301\n"
                "https://old.example/chain-b,https://new.example/final,301\n"
                "https://old.example/cycle-a,https://old.example/cycle-b,301\n"
                "https://old.example/cycle-b,https://old.example/cycle-a,301\n"
                "https://old.example/shared-a,https://new.example/shared,301\n"
                "https://old.example/shared-b,https://new.example/shared,301\n"
                ",https://new.example/missing-source,301\n"
                "https://old.example/missing-target,,301\n"
                "ftp://old.example/invalid,https://new.example/invalid,302\n"
                "https://old.example/invalid-target,javascript:private,301\n",
                encoding="utf-8",
            )

            report = preflight_redirect_map(source, target)

            self.assertEqual(
                report,
                RedirectPreflightReport(
                    input_rows=16,
                    input_columns=3,
                    findings=(
                        RedirectFinding("missing_source_url", "error", 1, (14,)),
                        RedirectFinding("missing_target_url", "error", 1, (15,)),
                        RedirectFinding("invalid_source_url", "error", 1, (16,)),
                        RedirectFinding("invalid_target_url", "error", 1, (17,)),
                        RedirectFinding("unsupported_status_code", "error", 1, (16,)),
                        RedirectFinding("duplicate_source", "warning", 2, (3, 4)),
                        RedirectFinding("conflicting_source", "error", 2, (5, 6)),
                        RedirectFinding("self_redirect", "error", 1, (7,)),
                        RedirectFinding("redirect_chain", "warning", 3, (8, 10, 11)),
                        RedirectFinding("redirect_cycle", "error", 2, (10, 11)),
                        RedirectFinding("shared_target", "warning", 2, (12, 13)),
                    ),
                ),
            )
            output = target.read_text(encoding="utf-8")
            self.assertIn("# Redirect map preflight", output)
            self.assertIn("| redirect_cycle | error | 2 | 10, 11 |", output)
            self.assertIn("supported static checks only", output)
            for private_value in (
                "Source URL",
                "Target URL",
                "Status Code",
                "old.example",
                "new.example",
                "javascript:private",
                "private-redirects.csv",
            ):
                self.assertNotIn(private_value, output)

    def test_accepts_unique_permanent_absolute_url_mappings(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "redirects.csv"
            target = directory / "preflight.md"
            source.write_text(
                "Source URL,Target URL,Status Code\n"
                "https://old.example/a,https://new.example/a,301\n"
                "https://old.example/b?x=1,https://new.example/b?x=1,308\n",
                encoding="utf-8",
            )

            report = preflight_redirect_map(source, target)

            self.assertEqual(report.findings, ())
            self.assertIn(
                "No findings from the supported static checks.",
                target.read_text(encoding="utf-8"),
            )

    def test_reports_missing_exact_headers_without_source_values(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "redirects.csv"
            target = directory / "preflight.md"
            source.write_text(
                "source,target,status\nprivate-old,private-new,private-code\n",
                encoding="utf-8",
            )

            report = preflight_redirect_map(source, target)

            self.assertEqual(
                report.findings,
                (
                    RedirectFinding("missing_source_url_header", "error", 1, ()),
                    RedirectFinding("missing_target_url_header", "error", 1, ()),
                    RedirectFinding("missing_status_code_header", "error", 1, ()),
                ),
            )
            output = target.read_text(encoding="utf-8")
            self.assertNotIn("private-old", output)
            self.assertNotIn("private-new", output)
            self.assertNotIn("private-code", output)

    def test_reports_duplicate_required_header_without_guessing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "redirects.csv"
            target = directory / "preflight.md"
            source.write_text(
                "Source URL,Source URL,Target URL,Status Code\n"
                "https://private.example/a,https://private.example/b,https://public.example/c,301\n",
                encoding="utf-8",
            )

            report = preflight_redirect_map(source, target)

            self.assertEqual(
                report.findings,
                (RedirectFinding("duplicate_source_url_header", "error", 2, ()),),
            )
            output = target.read_text(encoding="utf-8")
            self.assertNotIn("private.example", output)
            self.assertNotIn("public.example", output)

    def test_rejects_malformed_row_without_output(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "redirects.csv"
            target = directory / "preflight.md"
            source.write_text(
                "Source URL,Target URL,Status Code\n"
                "https://old.example/a,https://new.example/a,301,extra\n",
                encoding="utf-8",
            )

            with self.assertRaisesRegex(CsvShapeError, "line 2 has 4 columns; expected 3"):
                preflight_redirect_map(source, target)

            self.assertFalse(target.exists())

    def test_rejects_same_input_and_output_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "redirects.csv"
            source.write_text(
                "Source URL,Target URL,Status Code\n"
                "https://old.example/a,https://new.example/a,301\n",
                encoding="utf-8",
            )

            with self.assertRaisesRegex(CsvShapeError, "must be different files"):
                preflight_redirect_map(source, source)


if __name__ == "__main__":
    unittest.main()
