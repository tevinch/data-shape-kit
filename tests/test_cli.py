import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from io import StringIO
from pathlib import Path

from data_shape_kit.cli import main


class CliTests(unittest.TestCase):
    def test_success_prints_report_and_writes_output(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "input.csv"
            target = directory / "output.csv"
            source.write_text("Name,Region\nAda,EU\nAda,EU\n", encoding="utf-8")
            stdout = StringIO()
            stderr = StringIO()

            with redirect_stdout(stdout), redirect_stderr(stderr):
                exit_code = main([str(source), str(target)])

            self.assertEqual(exit_code, 0)
            self.assertEqual(
                stdout.getvalue(),
                "Input rows: 2\nOutput rows: 1\nDuplicates removed: 1\n",
            )
            self.assertEqual(stderr.getvalue(), "")
            self.assertEqual(target.read_text(encoding="utf-8"), "name,region\nAda,EU\n")

    def test_shape_error_returns_two_without_output(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "empty.csv"
            target = directory / "output.csv"
            source.write_text("", encoding="utf-8")
            stdout = StringIO()
            stderr = StringIO()

            with redirect_stdout(stdout), redirect_stderr(stderr):
                exit_code = main([str(source), str(target)])

            self.assertEqual(exit_code, 2)
            self.assertEqual(stdout.getvalue(), "")
            self.assertEqual(stderr.getvalue(), "error: expected a header row\n")
            self.assertFalse(target.exists())

    def test_profile_mode_writes_private_summary(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "input.csv"
            target = directory / "profile.json"
            source.write_text(
                "Name,Region\nsecret_alpha,EU\nsecret_beta,EU\n",
                encoding="utf-8",
            )
            stdout = StringIO()
            stderr = StringIO()

            with redirect_stdout(stdout), redirect_stderr(stderr):
                exit_code = main(["--profile", str(source), str(target)])

            self.assertEqual(exit_code, 0)
            self.assertEqual(stdout.getvalue(), "Input rows: 2\nColumns profiled: 2\n")
            self.assertEqual(stderr.getvalue(), "")
            output_text = target.read_text(encoding="utf-8")
            self.assertNotIn("secret_alpha", output_text)
            self.assertNotIn("secret_beta", output_text)

    def test_dictionary_mode_writes_value_free_markdown(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "input.csv"
            target = directory / "dictionary.md"
            source.write_text(
                "Name,Active\nsecret_alpha,true\nsecret_beta,false\n",
                encoding="utf-8",
            )
            stdout = StringIO()
            stderr = StringIO()

            with redirect_stdout(stdout), redirect_stderr(stderr):
                exit_code = main(["--dictionary", str(source), str(target)])

            self.assertEqual(exit_code, 0)
            self.assertEqual(stdout.getvalue(), "Input rows: 2\nColumns documented: 2\n")
            self.assertEqual(stderr.getvalue(), "")
            output_text = target.read_text(encoding="utf-8")
            self.assertIn("| 2 | active | boolean | 2 | 0 | 2 |", output_text)
            self.assertNotIn("secret_alpha", output_text)
            self.assertNotIn("secret_beta", output_text)

    def test_shopify_preflight_exit_status_reflects_findings(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "products.csv"
            target = directory / "preflight.md"
            source.write_text(
                "Title,URL handle\nPrivate Product,bad handle\n",
                encoding="utf-8",
            )
            stdout = StringIO()
            stderr = StringIO()

            with redirect_stdout(stdout), redirect_stderr(stderr):
                exit_code = main(["--shopify-preflight", str(source), str(target)])

            self.assertEqual(exit_code, 1)
            self.assertEqual(stdout.getvalue(), "Input rows: 1\nFindings: 1\n")
            self.assertEqual(stderr.getvalue(), "")
            output = target.read_text(encoding="utf-8")
            self.assertIn("invalid_handle_format", output)
            self.assertNotIn("Private Product", output)

    def test_woocommerce_preflight_exit_status_reflects_findings(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "products.csv"
            target = directory / "preflight.md"
            source.write_text(
                "Name,Type,SKU,Published\nPrivate Product,unknown,private-sku,public\n",
                encoding="utf-8",
            )
            stdout = StringIO()
            stderr = StringIO()

            with redirect_stdout(stdout), redirect_stderr(stderr):
                exit_code = main(
                    ["--woocommerce-preflight", str(source), str(target)]
                )

            self.assertEqual(exit_code, 1)
            self.assertEqual(stdout.getvalue(), "Input rows: 1\nFindings: 2\n")
            self.assertEqual(stderr.getvalue(), "")
            output = target.read_text(encoding="utf-8")
            self.assertIn("invalid_type", output)
            self.assertIn("invalid_published_value", output)
            self.assertNotIn("Private Product", output)

    def test_ebay_preflight_exit_status_reflects_findings(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "listings.csv"
            target = directory / "preflight.md"
            source.write_text(
                "Action,Category ID,Title\nAdd,not-numeric,Private Listing\n",
                encoding="utf-8",
            )
            stdout = StringIO()
            stderr = StringIO()

            with redirect_stdout(stdout), redirect_stderr(stderr):
                exit_code = main(["--ebay-preflight", str(source), str(target)])

            self.assertEqual(exit_code, 1)
            self.assertRegex(stdout.getvalue(), r"Input rows: 1\nFindings: [1-9][0-9]*\n")
            self.assertEqual(stderr.getvalue(), "")
            output = target.read_text(encoding="utf-8")
            self.assertIn("invalid_category_id", output)
            self.assertNotIn("Private Listing", output)

    def test_compare_mode_reports_findings_without_values(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            old = directory / "old.csv"
            new = directory / "new.csv"
            target = directory / "comparison.md"
            old.write_text("SKU,Name\nsecret-1,Private old\n", encoding="utf-8")
            new.write_text("SKU,Name\nsecret-1,Private new\n", encoding="utf-8")
            stdout = StringIO()
            stderr = StringIO()

            with redirect_stdout(stdout), redirect_stderr(stderr):
                exit_code = main(
                    [
                        "--compare-to",
                        str(new),
                        "--key",
                        "SKU",
                        str(old),
                        str(target),
                    ]
                )

            self.assertEqual(exit_code, 1)
            self.assertEqual(
                stdout.getvalue(), "Old rows: 1\nNew rows: 1\nFindings: 1\n"
            )
            self.assertEqual(stderr.getvalue(), "")
            output = target.read_text(encoding="utf-8")
            self.assertIn("changed_record", output)
            self.assertNotIn("secret-1", output)
            self.assertNotIn("Private old", output)
            self.assertNotIn("Private new", output)

    def test_compare_mode_requires_key_and_second_file_together(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "old.csv"
            target = directory / "comparison.md"
            source.write_text("ID\n1\n", encoding="utf-8")
            stderr = StringIO()

            with redirect_stderr(stderr):
                exit_code = main(["--key", "ID", str(source), str(target)])

            self.assertEqual(exit_code, 2)
            self.assertEqual(
                stderr.getvalue(),
                "error: --compare-to and --key must be used together\n",
            )
            self.assertFalse(target.exists())

    def test_redirect_preflight_exit_status_reflects_findings(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "redirects.csv"
            target = directory / "preflight.md"
            source.write_text(
                "Source URL,Target URL,Status Code\n"
                "https://private.example/a,https://private.example/a,301\n",
                encoding="utf-8",
            )
            stdout = StringIO()
            stderr = StringIO()

            with redirect_stdout(stdout), redirect_stderr(stderr):
                exit_code = main(
                    ["--redirect-preflight", str(source), str(target)]
                )

            self.assertEqual(exit_code, 1)
            self.assertEqual(stdout.getvalue(), "Input rows: 1\nFindings: 1\n")
            self.assertEqual(stderr.getvalue(), "")
            output = target.read_text(encoding="utf-8")
            self.assertIn("self_redirect", output)
            self.assertNotIn("private.example", output)

    def test_batch_preflight_exit_status_reflects_findings(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "inputs"
            source.mkdir()
            target = directory / "report.md"
            (source / "one.csv").write_text("ID,Name\n1,One\n", encoding="utf-8")
            (source / "two.csv").write_text("Name,ID\nTwo,2\n", encoding="utf-8")
            stdout = StringIO()
            stderr = StringIO()

            with redirect_stdout(stdout), redirect_stderr(stderr):
                exit_code = main(["--batch-preflight", str(source), str(target)])

            self.assertEqual(exit_code, 1)
            self.assertEqual(stdout.getvalue(), "Files: 2\nInput rows: 2\nFindings: 1\n")
            self.assertEqual(stderr.getvalue(), "")
            output = target.read_text(encoding="utf-8")
            self.assertIn("schema_mismatch", output)
            self.assertNotIn("one.csv", output)
            self.assertNotIn("two.csv", output)

    def test_merchant_feed_preflight_exit_status_reflects_findings(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "products.tsv"
            target = directory / "preflight.md"
            source.write_text(
                "id\ttitle\tdescription\tlink\timage_link\tavailability\tprice\n"
                "private-id\tPrivate\tPrivate\thttps://shop.example/item\thttps://shop.example/item.jpg\tsoon\t10 USD\n",
                encoding="utf-8",
            )
            stdout = StringIO()
            stderr = StringIO()

            with redirect_stdout(stdout), redirect_stderr(stderr):
                exit_code = main(
                    ["--merchant-feed-preflight", str(source), str(target)]
                )

            self.assertEqual(exit_code, 1)
            self.assertEqual(stdout.getvalue(), "Input rows: 1\nFindings: 1\n")
            self.assertEqual(stderr.getvalue(), "")
            output = target.read_text(encoding="utf-8")
            self.assertIn("invalid_availability", output)
            self.assertNotIn("private-id", output)


if __name__ == "__main__":
    unittest.main()
