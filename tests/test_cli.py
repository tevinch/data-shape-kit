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


if __name__ == "__main__":
    unittest.main()
