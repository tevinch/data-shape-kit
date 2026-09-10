"""Separate valid JSON object lines from rejected JSONL bytes."""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import BinaryIO, TextIO


@dataclass(frozen=True)
class PartitionStats:
    lines: int
    accepted: int
    rejected: int
    source_bytes: int
    accepted_bytes: int
    rejected_bytes: int


class _DuplicateKey(Exception):
    pass


class _NonFiniteNumber(Exception):
    pass


_ISSUE_DETAILS = {
    "line_too_long": "physical line exceeds max_line_bytes",
    "invalid_utf8": "physical line is not valid UTF-8",
    "blank_line": "physical line contains only JSON whitespace",
    "invalid_json": "physical line is not valid JSON",
    "non_object": "top-level JSON value is not an object",
    "duplicate_key": "JSON object contains a duplicate key",
    "non_finite_number": "JSON number is not finite",
    "invalid_unicode": "JSON string contains a lone surrogate",
}


def _write_all(stream, value) -> None:
    offset = 0
    while offset < len(value):
        written = stream.write(value[offset:])
        if type(written) is not int or written <= 0 or written > len(value) - offset:
            raise OSError("output stream write made no progress")
        offset += written


def _object_without_duplicates(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise _DuplicateKey
        result[key] = value
    return result


def _finite_float(value: str) -> float:
    number = float(value)
    if not math.isfinite(number):
        raise _NonFiniteNumber
    return number


def _reject_constant(value: str):
    raise _NonFiniteNumber


def _contains_lone_surrogate(value) -> bool:
    if isinstance(value, str):
        return any(0xD800 <= ord(character) <= 0xDFFF for character in value)
    if isinstance(value, list):
        return any(_contains_lone_surrogate(item) for item in value)
    if isinstance(value, dict):
        return any(
            _contains_lone_surrogate(key) or _contains_lone_surrogate(item)
            for key, item in value.items()
        )
    return False


def _classify(line: bytes) -> str | None:
    try:
        text = line.decode("utf-8", errors="strict")
    except UnicodeDecodeError:
        return "invalid_utf8"

    if all(character in " \t\r\n" for character in text):
        return "blank_line"

    try:
        value = json.loads(
            text,
            object_pairs_hook=_object_without_duplicates,
            parse_constant=_reject_constant,
            parse_float=_finite_float,
        )
    except _DuplicateKey:
        return "duplicate_key"
    except _NonFiniteNumber:
        return "non_finite_number"
    except (ValueError, RecursionError, OverflowError):
        return "invalid_json"

    if not isinstance(value, dict):
        return "non_object"
    try:
        has_lone_surrogate = _contains_lone_surrogate(value)
    except RecursionError:
        return "invalid_json"
    if has_lone_surrogate:
        return "invalid_unicode"
    return None


def _write_issue(
    issues: TextIO,
    *,
    line: int,
    source_offset: int,
    byte_length: int,
    rejected_offset: int,
    code: str,
) -> None:
    record = {
        "line": line,
        "source_offset": source_offset,
        "byte_length": byte_length,
        "rejected_offset": rejected_offset,
        "code": code,
        "detail": _ISSUE_DETAILS[code],
    }
    _write_all(issues, json.dumps(record, separators=(",", ":")) + "\n")


def partition_jsonl(
    source: BinaryIO,
    accepted: BinaryIO,
    rejected: BinaryIO,
    issues: TextIO,
    *,
    max_line_bytes: int = 8 * 1024 * 1024,
) -> PartitionStats:
    """Partition physical JSONL lines while preserving their original bytes."""
    if type(max_line_bytes) is not int:
        raise TypeError("max_line_bytes must be a positive integer")
    if max_line_bytes <= 0:
        raise ValueError("max_line_bytes must be a positive integer")
    streams = (source, accepted, rejected, issues)
    if len({id(stream) for stream in streams}) != len(streams):
        raise ValueError("source and output streams must be distinct objects")

    lines = 0
    accepted_count = 0
    rejected_count = 0
    source_bytes = 0
    accepted_bytes = 0
    rejected_bytes = 0

    while True:
        chunk = source.readline(max_line_bytes + 1)
        if not chunk:
            break

        lines += 1
        line_source_offset = source_bytes
        line_rejected_offset = rejected_bytes

        if len(chunk) > max_line_bytes:
            byte_length = 0
            while True:
                _write_all(rejected, chunk)
                byte_length += len(chunk)
                source_bytes += len(chunk)
                rejected_bytes += len(chunk)
                if chunk.endswith(b"\n"):
                    break
                chunk = source.readline(65536)
                if not chunk:
                    break
            rejected_count += 1
            _write_issue(
                issues,
                line=lines,
                source_offset=line_source_offset,
                byte_length=byte_length,
                rejected_offset=line_rejected_offset,
                code="line_too_long",
            )
            continue

        source_bytes += len(chunk)
        code = _classify(chunk)
        if code is None:
            _write_all(accepted, chunk)
            accepted_count += 1
            accepted_bytes += len(chunk)
        else:
            _write_all(rejected, chunk)
            rejected_count += 1
            rejected_bytes += len(chunk)
            _write_issue(
                issues,
                line=lines,
                source_offset=line_source_offset,
                byte_length=len(chunk),
                rejected_offset=line_rejected_offset,
                code=code,
            )

    return PartitionStats(
        lines=lines,
        accepted=accepted_count,
        rejected=rejected_count,
        source_bytes=source_bytes,
        accepted_bytes=accepted_bytes,
        rejected_bytes=rejected_bytes,
    )


def _positive_int(value: str) -> int:
    try:
        number = int(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("must be a positive integer") from error
    if number <= 0:
        raise argparse.ArgumentTypeError("must be a positive integer")
    return number


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Separate valid JSON object lines from rejected JSONL bytes."
    )
    parser.add_argument("input", type=Path, metavar="INPUT")
    parser.add_argument("--output-dir", type=Path, required=True, metavar="NEW_DIRECTORY")
    parser.add_argument(
        "--max-line-bytes",
        type=_positive_int,
        default=8 * 1024 * 1024,
        metavar="N",
    )
    return parser


def main(argv=None) -> int:
    args = _parser().parse_args(argv)
    try:
        source = args.input.open("rb")
        with source:
            os.mkdir(args.output_dir)
            with (
                (args.output_dir / "accepted.ndjson").open("xb") as accepted,
                (args.output_dir / "rejected.bin").open("xb") as rejected,
                (args.output_dir / "issues.ndjson").open(
                    "x", encoding="utf-8", newline="\n"
                ) as issues,
            ):
                stats = partition_jsonl(
                    source,
                    accepted,
                    rejected,
                    issues,
                    max_line_bytes=args.max_line_bytes,
                )

        summary = asdict(stats)
        with (args.output_dir / "summary.json").open(
            "x", encoding="utf-8", newline="\n"
        ) as summary_file:
            _write_all(
                summary_file,
                json.dumps(summary, separators=(",", ":")) + "\n",
            )
        print(json.dumps(summary, separators=(",", ":")))
        return 0
    except OSError as error:
        print(f"{Path(sys.argv[0]).name}: error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
