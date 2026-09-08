"""Value-free local checks for eBay listing and draft CSV files."""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

from .clean import CsvShapeError


@dataclass(frozen=True, slots=True)
class Finding:
    code: str
    severity: str
    count: int
    rows: tuple[int, ...]


@dataclass(frozen=True, slots=True)
class EbayPreflightReport:
    input_rows: int
    input_columns: int
    findings: tuple[Finding, ...]


_CATEGORY_ID = re.compile(r"[0-9]{1,10}")
_INTEGER = re.compile(r"[0-9]+")
_PRICE = re.compile(r"[0-9]+(?:\.[0-9]+)?")
_RELATIONSHIP_SPACING = re.compile(r"\s[=|;]|[=|;]\s")
_AUCTION_DURATIONS = {"1", "3", "5", "7", "10"}


def _value(row: list[str], index: int | None) -> str:
    return row[index].strip() if index is not None else ""


def _valid_positive_price(value: str) -> bool:
    if len(value) > 16 or not _PRICE.fullmatch(value):
        return False
    try:
        return Decimal(value) > 0
    except InvalidOperation:
        return False


def _valid_positive_integer(value: str) -> bool:
    return bool(_INTEGER.fullmatch(value)) and int(value) > 0


def _valid_photo_value(value: str) -> bool:
    if not value or len(value) > 2048 or any(character.isspace() for character in value):
        return False
    parts = value.split("|")
    if len(parts) > 12:
        return False
    for part in parts:
        candidate = part.split("=", 1)[-1]
        if not candidate.startswith(("http://", "https://")):
            return False
    return True


def _parse_relationship_details(value: str, *, parent: bool) -> dict[str, set[str]] | None:
    if not value or _RELATIONSHIP_SPACING.search(value):
        return None
    parsed: dict[str, set[str]] = {}
    for trait in value.split("|"):
        if trait.count("=") != 1:
            return None
        name, raw_values = trait.split("=", 1)
        values = raw_values.split(";") if parent else [raw_values]
        if not name or any(not item for item in values) or name in parsed:
            return None
        parsed[name] = set(values)
    return parsed


def _append(bucket: dict[str, list[int]], code: str, row: int) -> None:
    bucket.setdefault(code, []).append(row)


def preflight_ebay_csv(
    input_path: str | Path, output_path: str | Path
) -> EbayPreflightReport:
    """Write aggregate local findings without including source cell values."""
    source = Path(input_path)
    target = Path(output_path)
    if source.resolve() == target.resolve():
        raise CsvShapeError("input and output must be different files")

    try:
        with source.open(newline="", encoding="utf-8-sig") as handle:
            reader = csv.reader(handle, strict=True)
            headers: list[str] | None = None
            for row in reader:
                if row and row[0].startswith("#INFO"):
                    continue
                headers = row
                break
            if headers is None:
                raise CsvShapeError("expected a header row")
            if not headers:
                raise CsvShapeError("expected a header row with at least one column")

            rows: list[tuple[int, list[str]]] = []
            for row in reader:
                line_number = reader.line_num
                if len(row) != len(headers):
                    raise CsvShapeError(
                        f"line {line_number} has {len(row)} columns; expected {len(headers)}"
                    )
                rows.append((line_number, row))
    except UnicodeDecodeError as error:
        raise CsvShapeError("expected a UTF-8 CSV file") from error
    except csv.Error as error:
        raise CsvShapeError(f"invalid CSV: {error}") from error

    header_index = {name: index for index, name in enumerate(headers)}
    action_index = header_index.get("Action")
    category_index = header_index.get("Category ID")
    title_index = header_index.get("Title")
    relationship_index = header_index.get("Relationship")
    details_index = header_index.get("Relationship details")
    price_index = header_index.get("Start price")
    quantity_index = header_index.get("Quantity")
    photo_index = header_index.get("Item photo URL")
    sku_index = header_index.get("Custom label (SKU)")
    condition_index = header_index.get("Condition ID")
    description_index = header_index.get("Description")
    format_index = header_index.get("Format")
    duration_index = header_index.get("Duration")
    schedule_index = header_index.get("Schedule Time")

    buckets: dict[str, list[int]] = {}
    header_findings: list[Finding] = []
    if action_index is None:
        header_findings.append(Finding("missing_action_header", "error", 1, ()))
    if category_index is None:
        header_findings.append(Finding("missing_category_id_header", "error", 1, ()))
    if action_index is not None and title_index is None:
        header_findings.append(Finding("missing_title_header", "error", 1, ()))

    variation_parent_rows: set[int] = set()
    for position, (line_number, row) in enumerate(rows[:-1]):
        action = _value(row, action_index)
        next_relationship = _value(rows[position + 1][1], relationship_index)
        if action == "Add" and next_relationship == "Variation":
            variation_parent_rows.add(line_number)

    seen_skus: set[str] = set()
    active_parent: dict[str, set[str]] | None = None
    for line_number, row in rows:
        action = _value(row, action_index)
        relationship = _value(row, relationship_index)
        details = _value(row, details_index)
        is_variation_parent = line_number in variation_parent_rows
        is_variation_child = relationship == "Variation"

        if action_index is None:
            pass
        elif action and action not in {"Add", "Draft"}:
            _append(buckets, "unsupported_action", line_number)
        elif not action and not is_variation_child and relationship != "Compatibility":
            _append(buckets, "missing_action", line_number)

        if action in {"Add", "Draft"}:
            category_id = _value(row, category_index)
            if not _CATEGORY_ID.fullmatch(category_id):
                _append(buckets, "invalid_category_id", line_number)

        title = _value(row, title_index)
        if action == "Add":
            if not title:
                _append(buckets, "missing_title", line_number)
            elif len(title) > 80:
                _append(buckets, "title_too_long", line_number)
        elif title and len(title) > 80:
            _append(buckets, "title_too_long", line_number)

        sku = _value(row, sku_index)
        if sku:
            if sku in seen_skus:
                _append(buckets, "duplicate_sku", line_number)
            else:
                seen_skus.add(sku)

        if relationship and relationship not in {"Variation", "Compatibility"}:
            _append(buckets, "invalid_relationship", line_number)
        if relationship == "Compatibility":
            _append(buckets, "unsupported_compatibility_row", line_number)

        if action:
            active_parent = None
        if is_variation_parent:
            if not details:
                _append(buckets, "missing_relationship_details", line_number)
            elif _RELATIONSHIP_SPACING.search(details):
                _append(
                    buckets,
                    "invalid_relationship_details_spacing",
                    line_number,
                )
            active_parent = _parse_relationship_details(details, parent=True)
            if _value(row, price_index) or _value(row, quantity_index):
                _append(
                    buckets,
                    "variation_parent_with_price_or_quantity",
                    line_number,
                )
        elif is_variation_child:
            if active_parent is None:
                _append(buckets, "variation_without_parent", line_number)
            if not details:
                _append(buckets, "missing_relationship_details", line_number)
            elif _RELATIONSHIP_SPACING.search(details):
                _append(
                    buckets,
                    "invalid_relationship_details_spacing",
                    line_number,
                )
            else:
                child_details = _parse_relationship_details(details, parent=False)
                if active_parent is not None and child_details is not None:
                    if set(child_details) != set(active_parent) or any(
                        not values.issubset(active_parent[name])
                        for name, values in child_details.items()
                        if name in active_parent
                    ):
                        _append(buckets, "variation_value_not_declared", line_number)

        price = _value(row, price_index)
        quantity = _value(row, quantity_index)
        requires_price_quantity = action == "Add" and not is_variation_parent
        if requires_price_quantity or is_variation_child:
            if not price:
                _append(buckets, "missing_start_price", line_number)
            elif not _valid_positive_price(price):
                _append(buckets, "invalid_start_price", line_number)
            if not quantity:
                _append(buckets, "missing_quantity", line_number)
            elif not _valid_positive_integer(quantity):
                _append(buckets, "invalid_quantity", line_number)

        if action == "Add":
            photo = _value(row, photo_index)
            if not photo:
                _append(buckets, "missing_item_photo_url", line_number)
            elif not _valid_photo_value(photo):
                _append(buckets, "invalid_item_photo_url", line_number)

            condition_id = _value(row, condition_index)
            if not condition_id or not _INTEGER.fullmatch(condition_id):
                _append(buckets, "invalid_condition_id", line_number)

            if not _value(row, description_index):
                _append(buckets, "missing_description", line_number)

            listing_format = _value(row, format_index)
            if listing_format not in {"Auction", "FixedPrice"}:
                _append(buckets, "invalid_format", line_number)

            duration = _value(row, duration_index)
            if (listing_format == "FixedPrice" and duration != "GTC") or (
                listing_format == "Auction" and duration not in _AUCTION_DURATIONS
            ):
                _append(buckets, "invalid_duration", line_number)

        photo = _value(row, photo_index)
        if is_variation_child and photo and not _valid_photo_value(photo):
            _append(buckets, "invalid_item_photo_url", line_number)

        schedule_time = _value(row, schedule_index)
        if schedule_time:
            try:
                datetime.strptime(schedule_time, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                _append(buckets, "invalid_schedule_time", line_number)

    ordered_codes = (
        ("unsupported_action", "warning"),
        ("missing_action", "error"),
        ("invalid_category_id", "error"),
        ("missing_title", "error"),
        ("title_too_long", "error"),
        ("duplicate_sku", "warning"),
        ("invalid_relationship", "error"),
        ("unsupported_compatibility_row", "warning"),
        ("variation_without_parent", "error"),
        ("invalid_relationship_details_spacing", "error"),
        ("missing_relationship_details", "error"),
        ("variation_value_not_declared", "error"),
        ("invalid_start_price", "error"),
        ("invalid_quantity", "error"),
        ("missing_start_price", "error"),
        ("missing_quantity", "error"),
        ("missing_item_photo_url", "error"),
        ("invalid_item_photo_url", "error"),
        ("invalid_condition_id", "error"),
        ("missing_description", "error"),
        ("invalid_format", "error"),
        ("invalid_duration", "error"),
        ("invalid_schedule_time", "error"),
        ("variation_parent_with_price_or_quantity", "error"),
    )
    findings = list(header_findings)
    for code, severity in ordered_codes:
        finding_rows = buckets.get(code, [])
        if finding_rows:
            findings.append(
                Finding(code, severity, len(finding_rows), tuple(finding_rows))
            )

    report = EbayPreflightReport(
        input_rows=len(rows),
        input_columns=len(headers),
        findings=tuple(findings),
    )
    lines = [
        "# eBay listing file preflight",
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
            "This report covers supported local checks only and does not guarantee upload acceptance.",
        ]
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return report
