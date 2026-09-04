"""Command-line interface for local CSV cleanup and aggregate reports."""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence

from .clean import CsvShapeError, clean_csv
from .dictionary import write_dictionary
from .profile import profile_csv


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="data-shape-kit",
        description="Clean a CSV or write a value-free aggregate report locally.",
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--profile",
        action="store_true",
        help="write aggregate shape counts as JSON without source cell values",
    )
    mode.add_argument(
        "--dictionary",
        action="store_true",
        help="write a Markdown field dictionary without source cell values",
    )
    parser.add_argument("input", help="Path to the source CSV file")
    parser.add_argument("output", help="Path for the cleaned CSV file")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.profile:
            report = profile_csv(args.input, args.output)
        elif args.dictionary:
            report = write_dictionary(args.input, args.output)
        else:
            report = clean_csv(args.input, args.output)
    except (CsvShapeError, OSError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    print(f"Input rows: {report.input_rows}")
    if args.profile:
        print(f"Columns profiled: {report.input_columns}")
    elif args.dictionary:
        print(f"Columns documented: {report.input_columns}")
    else:
        print(f"Output rows: {report.output_rows}")
        print(f"Duplicates removed: {report.duplicates_removed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
