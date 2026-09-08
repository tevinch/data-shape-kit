"""Command-line interface for local CSV cleanup and aggregate reports."""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence

from .clean import CsvShapeError, clean_csv
from .compare import compare_csvs
from .dictionary import write_dictionary
from .ebay_preflight import preflight_ebay_csv
from .profile import profile_csv
from .shopify_preflight import preflight_shopify_csv
from .woocommerce_preflight import preflight_woocommerce_csv


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
    mode.add_argument(
        "--shopify-preflight",
        action="store_true",
        help="write value-free local checks for a Shopify product CSV",
    )
    mode.add_argument(
        "--woocommerce-preflight",
        action="store_true",
        help="write value-free local checks for a WooCommerce product CSV",
    )
    mode.add_argument(
        "--ebay-preflight",
        action="store_true",
        help="write value-free local checks for an eBay listing or draft CSV",
    )
    mode.add_argument(
        "--compare-to",
        metavar="NEW_CSV",
        help="compare the source to a second CSV and write a value-free report",
    )
    parser.add_argument(
        "--key",
        help="exact header used to match rows in comparison mode",
    )
    parser.add_argument("input", help="Path to the source CSV file")
    parser.add_argument("output", help="Path for the output file")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if (args.compare_to is None) != (args.key is None):
            raise CsvShapeError("--compare-to and --key must be used together")
        if args.compare_to is not None:
            report = compare_csvs(args.input, args.compare_to, args.key, args.output)
        elif args.profile:
            report = profile_csv(args.input, args.output)
        elif args.dictionary:
            report = write_dictionary(args.input, args.output)
        elif args.shopify_preflight:
            report = preflight_shopify_csv(args.input, args.output)
        elif args.woocommerce_preflight:
            report = preflight_woocommerce_csv(args.input, args.output)
        elif args.ebay_preflight:
            report = preflight_ebay_csv(args.input, args.output)
        else:
            report = clean_csv(args.input, args.output)
    except (CsvShapeError, OSError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    if args.compare_to is not None:
        print(f"Old rows: {report.old_rows}")
        print(f"New rows: {report.new_rows}")
        print(f"Findings: {len(report.findings)}")
        return 1 if report.findings else 0

    print(f"Input rows: {report.input_rows}")
    if args.profile:
        print(f"Columns profiled: {report.input_columns}")
    elif args.dictionary:
        print(f"Columns documented: {report.input_columns}")
    elif args.shopify_preflight or args.woocommerce_preflight or args.ebay_preflight:
        print(f"Findings: {len(report.findings)}")
        return 1 if report.findings else 0
    else:
        print(f"Output rows: {report.output_rows}")
        print(f"Duplicates removed: {report.duplicates_removed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
