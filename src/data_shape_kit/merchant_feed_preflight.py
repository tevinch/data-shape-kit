"""Value-free local checks for tab-delimited Merchant product feeds."""

from __future__ import annotations

import csv
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from pathlib import Path
from urllib.parse import urlsplit

from .clean import CsvShapeError


@dataclass(frozen=True, slots=True)
class MerchantFinding:
    code: str
    severity: str
    count: int
    rows: tuple[int, ...]


@dataclass(frozen=True, slots=True)
class MerchantFeedPreflightReport:
    input_rows: int
    input_columns: int
    findings: tuple[MerchantFinding, ...]


_ALLOWED_AVAILABILITY = {"in_stock", "out_of_stock", "preorder", "backorder"}
_ALLOWED_CONDITION = {"new", "refurbished", "used"}
_PRICE = re.compile(r"^(?P<amount>\d+(?:\.\d+)?) (?P<currency>[A-Z]{3})$")


def _valid_public_url(value: str) -> bool:
    if not value or len(value) > 2000 or any(character.isspace() for character in value):
        return False
    try:
        parsed = urlsplit(value)
        port = parsed.port
    except ValueError:
        return False
    return (
        parsed.scheme in {"http", "https"}
        and parsed.hostname is not None
        and parsed.username is None
        and parsed.password is None
        and (port is None or 0 < port <= 65535)
    )


def _valid_price(value: str) -> bool:
    match = _PRICE.fullmatch(value)
    if match is None:
        return False
    try:
        return Decimal(match.group("amount")) > 0
    except InvalidOperation:
        return False


def preflight_merchant_feed(
    input_path: str | Path, output_path: str | Path
) -> MerchantFeedPreflightReport:
    """Write supported feed findings without including source cell values."""
    source = Path(input_path)
    target = Path(output_path)
    if source.resolve() == target.resolve():
        raise CsvShapeError("input and output must be different files")

    malformed_rows: list[int] = []
    valid_rows: list[tuple[int, list[str]]] = []
    try:
        with source.open(newline="", encoding="utf-8-sig") as handle:
            reader = csv.reader(handle, delimiter="\t", strict=True)
            try:
                headers = next(reader)
            except StopIteration as error:
                raise CsvShapeError("expected a tab-delimited header row") from error
            if not headers:
                raise CsvShapeError(
                    "expected a tab-delimited header row with at least one column"
                )

            input_rows = 0
            for row in reader:
                input_rows += 1
                line_number = reader.line_num
                if len(row) != len(headers):
                    malformed_rows.append(line_number)
                    continue
                valid_rows.append((line_number, row))
    except UnicodeDecodeError as error:
        raise CsvShapeError("expected a UTF-8 tab-delimited product data file") from error
    except csv.Error as error:
        raise CsvShapeError(f"invalid tab-delimited product data: {error}") from error

    header_counts = Counter(headers)
    duplicate_names = {name for name, count in header_counts.items() if count > 1}
    indexes = {
        name: index
        for index, name in enumerate(headers)
        if header_counts[name] == 1
    }
    findings: list[MerchantFinding] = []
    if duplicate_names:
        findings.append(
            MerchantFinding("duplicate_header", "error", len(duplicate_names), ())
        )

    def exact_header(name: str) -> int | None:
        index = indexes.get(name)
        if index is None:
            findings.append(MerchantFinding(f"missing_{name}_header", "error", 1, ()))
        return index

    def alternative_header(
        choices: tuple[str, str], code_stem: str
    ) -> int | None:
        present = [name for name in choices if name in indexes]
        if not present:
            findings.append(
                MerchantFinding(f"missing_{code_stem}_header", "error", 1, ())
            )
            return None
        if len(present) > 1:
            findings.append(
                MerchantFinding(f"multiple_{code_stem}_headers", "warning", 1, ())
            )
            return None
        return indexes[present[0]]

    id_index = exact_header("id")
    title_index = alternative_header(("title", "structured_title"), "title")
    description_index = alternative_header(
        ("description", "structured_description"), "description"
    )
    link_index = exact_header("link")
    image_link_index = exact_header("image_link")
    availability_index = exact_header("availability")
    price_index = exact_header("price")
    condition_index = indexes.get("condition")
    video_link_index = indexes.get("video_link")
    availability_date_index = indexes.get("availability_date")

    buckets: dict[str, list[int]] = {"malformed_row": malformed_rows}
    id_rows: defaultdict[str, list[int]] = defaultdict(list)

    def record(code: str, line_number: int) -> None:
        buckets.setdefault(code, []).append(line_number)

    for line_number, row in valid_rows:
        if id_index is not None:
            product_id = row[id_index].strip()
            if not product_id:
                record("missing_id_value", line_number)
            else:
                id_rows[product_id].append(line_number)
                if len(product_id) > 50:
                    record("invalid_id", line_number)

        for index, code in (
            (title_index, "missing_title_value"),
            (description_index, "missing_description_value"),
            (link_index, "missing_link_value"),
            (image_link_index, "missing_image_link_value"),
            (availability_index, "missing_availability_value"),
            (price_index, "missing_price_value"),
        ):
            if index is not None and not row[index].strip():
                record(code, line_number)

        if link_index is not None:
            value = row[link_index].strip()
            if value and not _valid_public_url(value):
                record("invalid_link", line_number)
        if image_link_index is not None:
            value = row[image_link_index].strip()
            if value and not _valid_public_url(value):
                record("invalid_image_link", line_number)

        availability = ""
        if availability_index is not None:
            availability = row[availability_index].strip()
            if availability and availability not in _ALLOWED_AVAILABILITY:
                record("invalid_availability", line_number)
        if availability == "preorder" and (
            availability_date_index is None
            or not row[availability_date_index].strip()
        ):
            record("missing_availability_date", line_number)

        if price_index is not None:
            value = row[price_index].strip()
            if value and not _valid_price(value):
                record("invalid_price", line_number)
        if condition_index is not None:
            value = row[condition_index].strip()
            if value and value not in _ALLOWED_CONDITION:
                record("invalid_condition", line_number)
        if video_link_index is not None:
            value = row[video_link_index].strip()
            if value and not _valid_public_url(value):
                record("invalid_video_link", line_number)

    duplicate_id_rows = sorted(
        line_number
        for rows in id_rows.values()
        if len(rows) > 1
        for line_number in rows
    )
    if duplicate_id_rows:
        buckets["duplicate_id"] = duplicate_id_rows

    ordered_codes = (
        ("malformed_row", "error"),
        ("missing_id_value", "error"),
        ("duplicate_id", "error"),
        ("invalid_id", "error"),
        ("missing_title_value", "error"),
        ("missing_description_value", "error"),
        ("missing_link_value", "error"),
        ("missing_image_link_value", "error"),
        ("missing_availability_value", "error"),
        ("missing_price_value", "error"),
        ("invalid_link", "error"),
        ("invalid_image_link", "error"),
        ("invalid_availability", "error"),
        ("missing_availability_date", "error"),
        ("invalid_price", "error"),
        ("invalid_condition", "error"),
        ("invalid_video_link", "warning"),
    )
    findings.extend(
        MerchantFinding(code, severity, len(rows), tuple(rows))
        for code, severity in ordered_codes
        if (rows := buckets.get(code))
    )

    report = MerchantFeedPreflightReport(
        input_rows=input_rows,
        input_columns=len(headers),
        findings=tuple(findings),
    )
    lines = [
        "# Merchant product feed preflight",
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
            "This report covers supported static checks and does not include source cell values.",
            "It does not make network requests, inspect an account, or modify the input.",
            "It does not guarantee approval, eligibility, visibility, traffic, or sales.",
        ]
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return report
