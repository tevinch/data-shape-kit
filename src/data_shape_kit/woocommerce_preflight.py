"""Value-free local checks for WooCommerce product CSV files."""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from pathlib import Path

from .clean import CsvShapeError


@dataclass(frozen=True, slots=True)
class Finding:
    code: str
    severity: str
    count: int
    rows: tuple[int, ...]


@dataclass(frozen=True, slots=True)
class WooCommercePreflightReport:
    input_rows: int
    input_columns: int
    findings: tuple[Finding, ...]


_ALLOWED_TYPES = {
    "simple",
    "variable",
    "grouped",
    "external",
    "variation",
    "virtual",
    "downloadable",
}
_ALLOWED_PUBLISHED = {"1", "0", "-1", "2", "true", "false"}
_ATTRIBUTE_NAME = re.compile(r"Attribute ([1-9][0-9]*) name")
_ATTRIBUTE_VALUES = re.compile(r"Attribute ([1-9][0-9]*) value\(s\)")


def _type_tokens(value: str) -> tuple[str, ...]:
    return tuple(token.strip() for token in value.split(",") if token.strip())


def preflight_woocommerce_csv(
    input_path: str | Path, output_path: str | Path
) -> WooCommercePreflightReport:
    """Write aggregate local findings without including source cell values."""
    source = Path(input_path)
    target = Path(output_path)
    if source.resolve() == target.resolve():
        raise CsvShapeError("input and output must be different files")

    try:
        with source.open(newline="", encoding="utf-8-sig") as handle:
            reader = csv.reader(handle, strict=True)
            try:
                headers = next(reader)
            except StopIteration as error:
                raise CsvShapeError("expected a header row") from error

            if not headers:
                raise CsvShapeError("expected a header row with at least one column")

            header_index = {name: index for index, name in enumerate(headers)}
            type_index = header_index.get("Type")
            sku_index = header_index.get("SKU")
            published_index = header_index.get("Published")
            parent_index = header_index.get("Parent")

            attribute_names: dict[str, int] = {}
            attribute_values: dict[str, int] = {}
            for index, name in enumerate(headers):
                if match := _ATTRIBUTE_NAME.fullmatch(name):
                    attribute_names[match.group(1)] = index
                if match := _ATTRIBUTE_VALUES.fullmatch(name):
                    attribute_values[match.group(1)] = index
            incomplete_attribute_indexes = tuple(
                (attribute_names | attribute_values)[number]
                for number in sorted(
                    set(attribute_names) ^ set(attribute_values), key=int
                )
            )

            invalid_type_rows: list[int] = []
            invalid_published_rows: list[int] = []
            duplicate_sku_rows: list[int] = []
            variation_without_parent_rows: list[int] = []
            attribute_not_paired_rows: list[int] = []
            seen_skus: set[str] = set()
            input_rows = 0

            for line_number, row in enumerate(reader, start=2):
                if len(row) != len(headers):
                    raise CsvShapeError(
                        f"line {line_number} has {len(row)} columns; expected {len(headers)}"
                    )
                input_rows += 1

                type_tokens: tuple[str, ...] = ()
                if type_index is not None:
                    type_tokens = _type_tokens(row[type_index])
                    if type_tokens and any(
                        token not in _ALLOWED_TYPES for token in type_tokens
                    ):
                        invalid_type_rows.append(line_number)

                if published_index is not None:
                    published = row[published_index].strip()
                    if published and published not in _ALLOWED_PUBLISHED:
                        invalid_published_rows.append(line_number)

                if sku_index is not None:
                    sku = row[sku_index].strip()
                    if sku:
                        if sku in seen_skus:
                            duplicate_sku_rows.append(line_number)
                        else:
                            seen_skus.add(sku)

                if "variation" in type_tokens and (
                    parent_index is None or not row[parent_index].strip()
                ):
                    variation_without_parent_rows.append(line_number)

                if incomplete_attribute_indexes and any(
                    row[index].strip() for index in incomplete_attribute_indexes
                ):
                    attribute_not_paired_rows.append(line_number)
    except UnicodeDecodeError as error:
        raise CsvShapeError("expected a UTF-8 CSV file") from error
    except csv.Error as error:
        raise CsvShapeError(f"invalid CSV: {error}") from error

    findings: list[Finding] = []
    if "Name" not in header_index:
        findings.append(Finding("missing_name_header", "warning", 1, ()))
    for code, severity, rows in (
        ("invalid_type", "error", invalid_type_rows),
        ("invalid_published_value", "error", invalid_published_rows),
        ("duplicate_sku", "warning", duplicate_sku_rows),
        ("variation_without_parent", "error", variation_without_parent_rows),
        ("attribute_columns_not_paired", "error", attribute_not_paired_rows),
    ):
        if rows:
            findings.append(Finding(code, severity, len(rows), tuple(rows)))

    report = WooCommercePreflightReport(
        input_rows=input_rows,
        input_columns=len(headers),
        findings=tuple(findings),
    )
    lines = [
        "# WooCommerce product CSV preflight",
        "",
        f"- Rows: {report.input_rows}",
        f"- Columns: {report.input_columns}",
        f"- Findings: {len(report.findings)}",
        "",
    ]
    if report.findings:
        lines.extend(
            [
                "| Check | Severity | Count | Rows |",
                "| --- | --- | ---: | --- |",
            ]
        )
        lines.extend(
            f"| {finding.code} | {finding.severity} | {finding.count} | "
            f"{', '.join(str(row) for row in finding.rows) if finding.rows else '-'} |"
            for finding in report.findings
        )
    else:
        lines.append("No findings from the supported local checks.")
    lines.extend(
        [
            "",
            "This report covers supported local checks only and does not guarantee import acceptance.",
        ]
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return report
