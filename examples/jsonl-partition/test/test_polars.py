import io
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from jsonl_partition import partition_jsonl

try:
    import polars as pl
except ImportError:
    pl = None


@unittest.skipIf(pl is None, "optional Polars integration dependency is unavailable")
class PolarsIntegrationTests(unittest.TestCase):
    schema = {"a": pl.Int64, "b": pl.Int64} if pl is not None else None

    def partition(self, data):
        accepted = io.BytesIO()
        rejected = io.BytesIO()
        issues = io.StringIO()
        stats = partition_jsonl(io.BytesIO(data), accepted, rejected, issues)
        return stats, accepted.getvalue(), rejected.getvalue(), [
            json.loads(line) for line in issues.getvalue().splitlines()
        ]

    def test_partition_unblocks_eager_and_lazy_reads_of_middle_malformed_line(self):
        source = b'{"a": 1,"b": 3}\nx\n{"a": 4,"b": 2}\n'
        with tempfile.TemporaryDirectory() as temp:
            original_path = Path(temp) / "original.ndjson"
            original_path.write_bytes(source)

            with self.assertRaises(pl.exceptions.ComputeError):
                pl.read_ndjson(
                    io.BytesIO(source), schema=self.schema, ignore_errors=True
                )
            with self.assertRaises(pl.exceptions.ComputeError):
                pl.scan_ndjson(
                    original_path, schema=self.schema, ignore_errors=True
                ).collect()

            stats, accepted, rejected, issues = self.partition(source)
            accepted_path = Path(temp) / "accepted.ndjson"
            accepted_path.write_bytes(accepted)

            eager = pl.read_ndjson(io.BytesIO(accepted), schema=self.schema)
            lazy = pl.scan_ndjson(accepted_path, schema=self.schema).collect()

        expected = [{"a": 1, "b": 3}, {"a": 4, "b": 2}]
        self.assertEqual(eager.to_dicts(), expected)
        self.assertEqual(lazy.to_dicts(), expected)
        self.assertEqual(stats.lines, 3)
        self.assertEqual(stats.accepted, 2)
        self.assertEqual(stats.rejected, 1)
        self.assertEqual(rejected, b"x\n")
        self.assertEqual(issues[0]["line"], 2)
        self.assertEqual(issues[0]["source_offset"], 16)

    def test_malformed_first_line_and_unicode_crlf_rows_are_readable(self):
        source = (
            b"not-json\n"
            b'{"a":1,"b":2,"label":"caf\xc3\xa9"}\r\n'
            b'{"a":3,"b":4,"label":"\xe6\x9d\xb1\xe4\xba\xac"}\r\n'
        )
        stats, accepted, rejected, issues = self.partition(source)
        frame = pl.read_ndjson(
            io.BytesIO(accepted),
            schema={"a": pl.Int64, "b": pl.Int64, "label": pl.String},
        )

        self.assertEqual(frame.to_dicts(), [
            {"a": 1, "b": 2, "label": "caf\u00e9"},
            {"a": 3, "b": 4, "label": "\u6771\u4eac"},
        ])
        self.assertEqual(stats.accepted, 2)
        self.assertEqual(rejected, b"not-json\n")
        self.assertEqual(issues[0]["line"], 1)
        self.assertEqual(issues[0]["source_offset"], 0)

    def test_valid_json_schema_mismatch_remains_a_polars_error(self):
        source = b'{"a":"not-an-integer","b":2}\n'
        stats, accepted, rejected, issues = self.partition(source)

        self.assertEqual(stats.accepted, 1)
        self.assertEqual(rejected, b"")
        self.assertEqual(issues, [])
        with self.assertRaises(pl.exceptions.ComputeError):
            pl.read_ndjson(io.BytesIO(accepted), schema=self.schema)


@unittest.skipIf(pl is None, "optional Polars integration dependency is unavailable")
class ExampleTests(unittest.TestCase):
    def test_example_prints_repeatable_real_polars_results(self):
        script = Path(__file__).resolve().parents[1] / "polars_example.py"
        first = subprocess.run(
            [sys.executable, str(script)], capture_output=True, text=True, check=True
        )
        second = subprocess.run(
            [sys.executable, str(script)], capture_output=True, text=True, check=True
        )

        self.assertEqual(first.stderr, "")
        self.assertEqual(first.stdout, second.stdout)
        result = json.loads(first.stdout)
        self.assertEqual(result, {
            "polars_version": "1.44.2",
            "source_lines": 3,
            "stats": {
                "lines": 3,
                "accepted": 2,
                "rejected": 1,
                "source_bytes": 34,
                "accepted_bytes": 32,
                "rejected_bytes": 2,
            },
            "issues": [{
                "line": 2,
                "source_offset": 16,
                "byte_length": 2,
                "rejected_offset": 0,
                "code": "invalid_json",
                "detail": "physical line is not valid JSON",
            }],
            "rejected_text": "x\n",
            "eager_rows": [{"a": 1, "b": 3}, {"a": 4, "b": 2}],
            "lazy_rows": [{"a": 1, "b": 3}, {"a": 4, "b": 2}],
        })


if __name__ == "__main__":
    unittest.main()
