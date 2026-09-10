import io
import json
import subprocess
import sys
import tempfile
import unittest
from dataclasses import FrozenInstanceError
from pathlib import Path

from jsonl_partition import PartitionStats, partition_jsonl


class BoundedReader:
    def __init__(self, data: bytes):
        self._stream = io.BytesIO(data)
        self.readline_sizes = []

    def readline(self, size=-1):
        if size is None or size < 0:
            raise AssertionError("readline must be bounded")
        self.readline_sizes.append(size)
        return self._stream.readline(size)

    def read(self, *args, **kwargs):
        raise AssertionError("read must not be used")

    def seek(self, *args, **kwargs):
        raise AssertionError("seek must not be used")

    def tell(self):
        raise AssertionError("tell must not be used")

    def close(self):
        raise AssertionError("caller-owned input must not be closed")


class ShortWriter:
    def __init__(self, limit):
        self.limit = limit
        self.parts = []

    def write(self, value):
        count = min(self.limit, len(value))
        self.parts.append(value[:count])
        return count

    def value(self):
        if not self.parts:
            return b""
        if isinstance(self.parts[0], str):
            return "".join(self.parts)
        return b"".join(self.parts)


class NoProgressWriter:
    def write(self, value):
        return 0


def run_partition(data: bytes, *, max_line_bytes=8 * 1024 * 1024):
    accepted = io.BytesIO()
    rejected = io.BytesIO()
    issues = io.StringIO()
    stats = partition_jsonl(
        io.BytesIO(data),
        accepted,
        rejected,
        issues,
        max_line_bytes=max_line_bytes,
    )
    issue_records = [json.loads(line) for line in issues.getvalue().splitlines()]
    return stats, accepted.getvalue(), rejected.getvalue(), issue_records


class PartitionJsonlTests(unittest.TestCase):
    def test_preserves_original_bytes_and_tracks_hand_checked_offsets(self):
        good_crlf = b'{"n":1,"text":"caf\xc3\xa9"}\r\n'
        blank = b" \t\r\n"
        good_escaped = b'{"escaped":"line\\nnext","values":[1,true,null]}\n'
        malformed_final = b"not-json"

        stats, accepted, rejected, issues = run_partition(
            good_crlf + blank + good_escaped + malformed_final
        )

        self.assertEqual(accepted, good_crlf + good_escaped)
        self.assertEqual(rejected, blank + malformed_final)
        self.assertEqual(
            stats,
            PartitionStats(
                lines=4,
                accepted=2,
                rejected=2,
                source_bytes=84,
                accepted_bytes=72,
                rejected_bytes=12,
            ),
        )
        self.assertEqual(
            issues,
            [
                {
                    "line": 2,
                    "source_offset": 24,
                    "byte_length": 4,
                    "rejected_offset": 0,
                    "code": "blank_line",
                    "detail": "physical line contains only JSON whitespace",
                },
                {
                    "line": 4,
                    "source_offset": 76,
                    "byte_length": 8,
                    "rejected_offset": 4,
                    "code": "invalid_json",
                    "detail": "physical line is not valid JSON",
                },
            ],
        )
        with self.assertRaises(FrozenInstanceError):
            stats.lines = 99

    def test_classifies_every_rejection_code_without_exposing_contents(self):
        cases = {
            "line_too_long": (b'{"a":1}\n', 7),
            "invalid_utf8": (b'{"secret":"\xff"}\n', 100),
            "blank_line": (b"\t \r\n", 100),
            "invalid_json": (b'{"secret":}\n', 100),
            "non_object": (b"[1,2]\n", 100),
            "duplicate_key": (b'{"outer":{"secret":1,"secret":2}}\n', 100),
            "non_finite_number": (b'{"value":NaN}\n', 100),
            "invalid_unicode": (b'{"value":"\\ud800"}\n', 100),
        }

        for expected_code, (data, limit) in cases.items():
            with self.subTest(code=expected_code):
                stats, accepted, rejected, issues = run_partition(
                    data, max_line_bytes=limit
                )
                self.assertEqual(stats.accepted, 0)
                self.assertEqual(stats.rejected, 1)
                self.assertEqual(accepted, b"")
                self.assertEqual(rejected, data)
                self.assertEqual(issues[0]["code"], expected_code)
                metadata = json.dumps(issues[0])
                self.assertNotIn("secret", metadata)
                self.assertEqual(set(issues[0]), {
                    "line", "source_offset", "byte_length", "rejected_offset",
                    "code", "detail",
                })

    def test_rejects_special_numeric_and_unicode_variants(self):
        cases = [
            (b'{"value":Infinity}\n', "non_finite_number"),
            (b'{"value":-Infinity}\n', "non_finite_number"),
            (b'{"value":1e400}\n', "non_finite_number"),
            (b'{"\\udfff":1}\n', "invalid_unicode"),
            (b'{"nested":["\\ud800"]}\n', "invalid_unicode"),
        ]
        for data, expected_code in cases:
            with self.subTest(data=data):
                self.assertEqual(run_partition(data)[3][0]["code"], expected_code)

    def test_rejects_bom_deep_json_and_each_non_object_value(self):
        cases = [
            (b'\xef\xbb\xbf{"a":1}\n', "invalid_json"),
            (b"[" * 20000 + b"]" * 20000 + b"\n", "invalid_json"),
            (b'{"n":' + b"1" * 5000 + b"}\n", "invalid_json"),
            (
                b'{"nested":' + b"[" * 5000 + b"0" + b"]" * 5000 + b"}\n",
                "invalid_json",
            ),
            (b"[]\n", "non_object"),
            (b"1\n", "non_object"),
            (b"true\n", "non_object"),
            (b"null\n", "non_object"),
            (b'"text"\n', "non_object"),
        ]
        for data, expected_code in cases:
            with self.subTest(expected_code=expected_code, prefix=data[:10]):
                self.assertEqual(run_partition(data)[3][0]["code"], expected_code)

    def test_counts_empty_only_accepted_and_only_rejected_inputs(self):
        empty = run_partition(b"")
        self.assertEqual(empty[0], PartitionStats(0, 0, 0, 0, 0, 0))
        self.assertEqual(empty[1:], (b"", b"", []))

        accepted = run_partition(b'{"a":1}\n{"a":2}')
        self.assertEqual(accepted[0], PartitionStats(2, 2, 0, 15, 15, 0))
        self.assertEqual(accepted[1], b'{"a":1}\n{"a":2}')

        rejected = run_partition(b"x\n\n")
        self.assertEqual(rejected[0], PartitionStats(2, 0, 2, 3, 0, 3))
        self.assertEqual(rejected[2], b"x\n\n")

    def test_max_line_bytes_includes_terminator_at_exact_boundaries(self):
        exact = run_partition(b"{}\n", max_line_bytes=3)
        self.assertEqual(exact[1], b"{}\n")
        self.assertEqual(exact[3], [])

        over = run_partition(b"{}\n", max_line_bytes=2)
        self.assertEqual(over[2], b"{}\n")
        self.assertEqual(over[3][0]["code"], "line_too_long")

        unterminated = run_partition(b"{}", max_line_bytes=2)
        self.assertEqual(unterminated[1], b"{}")

    def test_oversized_line_is_drained_with_bounded_reads_and_next_line_survives(self):
        oversized = b'{"value":"' + b"a" * 200000 + b'"}\r\n'
        following = b'{"value":2}\n'
        source = BoundedReader(oversized + following)
        accepted = io.BytesIO()
        rejected = io.BytesIO()
        issues = io.StringIO()

        stats = partition_jsonl(
            source, accepted, rejected, issues, max_line_bytes=32
        )

        self.assertEqual(accepted.getvalue(), following)
        self.assertEqual(rejected.getvalue(), oversized)
        self.assertEqual(stats, PartitionStats(
            lines=2,
            accepted=1,
            rejected=1,
            source_bytes=200026,
            accepted_bytes=12,
            rejected_bytes=200014,
        ))
        issue = json.loads(issues.getvalue())
        self.assertEqual(issue["byte_length"], 200014)
        self.assertEqual(issue["source_offset"], 0)
        self.assertEqual(issue["rejected_offset"], 0)
        self.assertEqual(issue["code"], "line_too_long")
        self.assertEqual(source.readline_sizes[0], 33)
        self.assertIn(65536, source.readline_sizes)
        self.assertTrue(all(0 < size <= 65536 for size in source.readline_sizes))

    def test_validates_options_and_distinct_stream_objects_before_io(self):
        class Untouchable:
            def readline(self, size):
                raise AssertionError("input was consumed")

            def write(self, value):
                raise AssertionError("output was written")

        for invalid in (True, False, 0, -1, 1.5, "10", None):
            with self.subTest(invalid=invalid):
                with self.assertRaises((TypeError, ValueError)):
                    partition_jsonl(
                        Untouchable(), Untouchable(), Untouchable(), Untouchable(),
                        max_line_bytes=invalid,
                    )

        for duplicate_pair in ((0, 1), (0, 3), (1, 2), (1, 3), (2, 3)):
            streams = [Untouchable() for _ in range(4)]
            streams[duplicate_pair[1]] = streams[duplicate_pair[0]]
            with self.subTest(duplicate_pair=duplicate_pair):
                with self.assertRaises(ValueError):
                    partition_jsonl(*streams)

    def test_handles_short_writes_and_rejects_non_progress(self):
        source = io.BytesIO(b'{"a":1}\ninvalid\n')
        accepted = ShortWriter(2)
        rejected = ShortWriter(3)
        issues = ShortWriter(5)

        stats = partition_jsonl(source, accepted, rejected, issues)

        self.assertEqual(accepted.value(), b'{"a":1}\n')
        self.assertEqual(rejected.value(), b"invalid\n")
        self.assertEqual(json.loads(issues.value()), {
            "line": 2,
            "source_offset": 8,
            "byte_length": 8,
            "rejected_offset": 0,
            "code": "invalid_json",
            "detail": "physical line is not valid JSON",
        })
        self.assertEqual(stats.accepted_bytes, 8)
        self.assertEqual(stats.rejected_bytes, 8)

        with self.assertRaises(OSError):
            partition_jsonl(
                io.BytesIO(b'{"a":1}\n'),
                NoProgressWriter(),
                io.BytesIO(),
                io.StringIO(),
            )

    def test_propagates_read_and_write_errors_without_returning_stats(self):
        class BrokenReader:
            def readline(self, size):
                raise OSError("read failed")

        class BrokenWriter:
            def write(self, value):
                raise OSError("write failed")

        with self.assertRaisesRegex(OSError, "read failed"):
            partition_jsonl(BrokenReader(), io.BytesIO(), io.BytesIO(), io.StringIO())

        with self.assertRaisesRegex(OSError, "write failed"):
            partition_jsonl(
                io.BytesIO(b'{"a":1}\n'),
                BrokenWriter(),
                io.BytesIO(),
                io.StringIO(),
            )


class CommandLineTests(unittest.TestCase):
    script = Path(__file__).resolve().parents[1] / "jsonl_partition.py"

    def run_cli(self, *args):
        return subprocess.run(
            [sys.executable, str(self.script), *map(str, args)],
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
            check=False,
        )

    def test_cli_writes_exact_outputs_summary_and_stdout(self):
        data = b'{"a":1}\r\nx\n{"a":2}'
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "input.ndjson"
            output = root / "result"
            source.write_bytes(data)

            result = self.run_cli(source, "--output-dir", output)

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stderr, "")
            self.assertEqual(source.read_bytes(), data)
            self.assertEqual(
                (output / "accepted.ndjson").read_bytes(),
                b'{"a":1}\r\n{"a":2}',
            )
            self.assertEqual((output / "rejected.bin").read_bytes(), b"x\n")
            issue = json.loads((output / "issues.ndjson").read_text("utf-8"))
            self.assertEqual(issue["line"], 2)
            self.assertEqual(issue["source_offset"], 9)
            self.assertEqual(issue["byte_length"], 2)
            self.assertEqual(issue["rejected_offset"], 0)
            summary = {
                "lines": 3,
                "accepted": 2,
                "rejected": 1,
                "source_bytes": 18,
                "accepted_bytes": 16,
                "rejected_bytes": 2,
            }
            self.assertEqual(json.loads((output / "summary.json").read_text("utf-8")), summary)
            self.assertEqual(json.loads(result.stdout), summary)

    def test_cli_refuses_existing_paths_without_altering_them(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "input.ndjson"
            source.write_bytes(b'{"a":1}\n')

            existing_dir = root / "existing"
            existing_dir.mkdir()
            marker = existing_dir / "keep.txt"
            marker.write_text("keep", "utf-8")
            result = self.run_cli(source, "--output-dir", existing_dir)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(result.stdout, "")
            self.assertEqual(marker.read_text("utf-8"), "keep")
            self.assertEqual(sorted(p.name for p in existing_dir.iterdir()), ["keep.txt"])

            existing_file = root / "existing-file"
            existing_file.write_text("keep", "utf-8")
            result = self.run_cli(source, "--output-dir", existing_file)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(result.stdout, "")
            self.assertEqual(existing_file.read_text("utf-8"), "keep")

    def test_cli_validates_before_creating_output_and_reports_io_failure(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)

            missing_output = root / "missing-output"
            result = self.run_cli(
                root / "missing.ndjson", "--output-dir", missing_output
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(result.stdout, "")
            self.assertFalse(missing_output.exists())
            self.assertTrue(result.stderr.strip())

            invalid_output = root / "invalid-output"
            source = root / "input.ndjson"
            source.write_bytes(b'{}\n')
            result = self.run_cli(
                source, "--output-dir", invalid_output, "--max-line-bytes", "0"
            )
            self.assertEqual(result.returncode, 2)
            self.assertEqual(result.stdout, "")
            self.assertFalse(invalid_output.exists())

            directory_input = root / "directory-input"
            directory_input.mkdir()
            io_output = root / "io-output"
            result = self.run_cli(directory_input, "--output-dir", io_output)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(result.stdout, "")
            self.assertFalse(io_output.exists())
            self.assertFalse((io_output / "summary.json").exists())


if __name__ == "__main__":
    unittest.main()
