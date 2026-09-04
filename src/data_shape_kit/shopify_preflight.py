"""Value-free local checks for Shopify product CSV files."""

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
class ShopifyPreflightReport:
    input_rows: int
    input_columns: int
    findings: tuple[Finding, ...]


_HANDLE = re.compile(r"[A-Za-z0-9-]+")
_CURRENT_VARIANT_FIELDS = {
    "SKU",
    "Weight value (grams)",
    "Price",
    "Compare-at price",
}
_LEGACY_VARIANT_FIELDS = {
    "Variant SKU",
    "Variant Grams",
    "Variant Price",
    "Variant Compare-at Price",
}


def preflight_shopify_csv(
    input_path: str | Path, output_path: str | Path
) -> ShopifyPreflightReport:
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
            handle_name = (
                "URL handle"
                if "URL handle" in header_index
                else "Handle" if "Handle" in header_index else None
            )
            handle_index = header_index.get(handle_name) if handle_name else None

            if "URL handle" in header_index:
                option_headers = ("Option1 name", "Option1 value")
            elif "Handle" in header_index:
                option_headers = ("Option1 Name", "Option1 Value")
            elif "Option1 name" in header_index or "Option1 value" in header_index:
                option_headers = ("Option1 name", "Option1 value")
            else:
                option_headers = ("Option1 Name", "Option1 Value")

            variant_indexes = tuple(
                index
                for name, index in header_index.items()
                if name in _CURRENT_VARIANT_FIELDS or name in _LEGACY_VARIANT_FIELDS
            )
            has_option_headers = all(name in header_index for name in option_headers)

            invalid_handle_rows: list[int] = []
            non_contiguous_rows: list[int] = []
            variant_dependency_rows: list[int] = []
            previous_handle: str | None = None
            closed_handles: set[str] = set()
            input_rows = 0

            for line_number, row in enumerate(reader, start=2):
                if len(row) != len(headers):
                    raise CsvShapeError(
                        f"line {line_number} has {len(row)} columns; expected {len(headers)}"
                    )
                input_rows += 1

                if handle_index is not None:
                    value = row[handle_index].strip()
                    if value and not _HANDLE.fullmatch(value):
                        invalid_handle_rows.append(line_number)
                    if not value:
                        if previous_handle is not None:
                            closed_handles.add(previous_handle)
                        previous_handle = None
                    elif value != previous_handle:
                        if previous_handle is not None:
                            closed_handles.add(previous_handle)
                        if value in closed_handles:
                            non_contiguous_rows.append(line_number)
                        previous_handle = value

                if variant_indexes and not has_option_headers:
                    if any(row[index].strip() for index in variant_indexes):
                        variant_dependency_rows.append(line_number)
    except UnicodeDecodeError as error:
        raise CsvShapeError("expected a UTF-8 CSV file") from error
    except csv.Error as error:
        raise CsvShapeError(f"invalid CSV: {error}") from error

    findings: list[Finding] = []
    if "Title" not in header_index:
        findings.append(Finding("missing_title_header", "error", 1, ()))
    if handle_index is None:
        findings.append(Finding("missing_handle_header", "warning", 1, ()))
    if invalid_handle_rows:
        findings.append(
            Finding(
                "invalid_handle_format",
                "error",
                len(invalid_handle_rows),
                tuple(invalid_handle_rows),
            )
        )
    if non_contiguous_rows:
        findings.append(
            Finding(
                "non_contiguous_handle_group",
                "warning",
                len(non_contiguous_rows),
                tuple(non_contiguous_rows),
            )
        )
    if variant_dependency_rows:
        findings.append(
            Finding(
                "variant_fields_without_option1_headers",
                "error",
                len(variant_dependency_rows),
                tuple(variant_dependency_rows),
            )
        )

    report = ShopifyPreflightReport(
        input_rows=input_rows,
        input_columns=len(headers),
        findings=tuple(findings),
    )
    lines = [
        "# Shopify product CSV preflight",
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
