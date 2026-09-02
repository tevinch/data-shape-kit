"""Command-line interface for local CSV cleanup."""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence

from .clean import CsvShapeError, clean_csv


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="data-shape-kit",
        description="Normalize and deduplicate a CSV file locally.",
    )
    parser.add_argument("input", help="Path to the source CSV file")
    parser.add_argument("output", help="Path for the cleaned CSV file")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        report = clean_csv(args.input, args.output)
    except (CsvShapeError, OSError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    print(f"Input rows: {report.input_rows}")
    print(f"Output rows: {report.output_rows}")
    print(f"Duplicates removed: {report.duplicates_removed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
