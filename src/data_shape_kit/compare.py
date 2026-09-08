"""Value-free, exact-key comparison for two local CSV files."""

from __future__ import annotations

import csv
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

from .clean import CsvShapeError


@dataclass(frozen=True, slots=True)
class ComparisonFinding:
    code: str
    severity: str
    count: int
    old_rows: tuple[int, ...] = ()
    new_rows: tuple[int, ...] = ()


@dataclass(frozen=True, slots=True)
class CsvComparisonReport:
    old_rows: int
    new_rows: int
    old_columns: int
    new_columns: int
    matched_unchanged: int
    findings: tuple[ComparisonFinding, ...]


def _read_csv(
    path: Path, *, label: str
) -> tuple[list[str], list[tuple[int, tuple[str, ...]]]]:
    try:
        with path.open(newline="", encoding="utf-8-sig") as handle:
            reader = csv.reader(handle, strict=True)
            try:
                headers = next(reader)
            except StopIteration as error:
                raise CsvShapeError(f"{label} file must contain a header row") from error
            if not headers:
                raise CsvShapeError(
                    f"{label} file must contain at least one header column"
                )

            rows: list[tuple[int, tuple[str, ...]]] = []
            for line_number, row in enumerate(reader, start=2):
                if len(row) != len(headers):
                    raise CsvShapeError(
                        f"{label} file line {line_number} has {len(row)} columns; "
                        f"expected {len(headers)}"
                    )
                rows.append((line_number, tuple(row)))
    except UnicodeDecodeError as error:
        raise CsvShapeError(f"{label} file must be UTF-8 CSV") from error
    except csv.Error as error:
        raise CsvShapeError(f"invalid {label} CSV: {error}") from error
    return headers, rows


def _format_rows(rows: tuple[int, ...]) -> str:
    return ", ".join(str(row) for row in rows) if rows else "-"


def compare_csvs(
    old_path: str | Path,
    new_path: str | Path,
    key: str,
    output_path: str | Path,
) -> CsvComparisonReport:
    """Compare two CSV files by an exact key and write only counts and row numbers."""
    old_source = Path(old_path)
    new_source = Path(new_path)
    target = Path(output_path)
    resolved_paths = {
        old_source.resolve(),
        new_source.resolve(),
        target.resolve(),
    }
    if len(resolved_paths) != 3:
        raise CsvShapeError("old, new, and output must be different files")

    old_headers, old_rows = _read_csv(old_source, label="old")
    new_headers, new_rows = _read_csv(new_source, label="new")
    if old_headers.count(key) != 1 or new_headers.count(key) != 1:
        raise CsvShapeError("comparison key must appear exactly once in both files")
    if len(set(old_headers)) != len(old_headers) or len(set(new_headers)) != len(
        new_headers
    ):
        raise CsvShapeError("headers must be unique within each file")

    old_index = {header: index for index, header in enumerate(old_headers)}
    new_index = {header: index for index, header in enumerate(new_headers)}
    old_key_index = old_index[key]
    new_key_index = new_index[key]

    old_by_key: defaultdict[str, list[tuple[int, tuple[str, ...]]]] = defaultdict(list)
    new_by_key: defaultdict[str, list[tuple[int, tuple[str, ...]]]] = defaultdict(list)
    missing_old: list[int] = []
    missing_new: list[int] = []
    for line_number, row in old_rows:
        row_key = row[old_key_index]
        if row_key == "":
            missing_old.append(line_number)
        else:
            old_by_key[row_key].append((line_number, row))
    for line_number, row in new_rows:
        row_key = row[new_key_index]
        if row_key == "":
            missing_new.append(line_number)
        else:
            new_by_key[row_key].append((line_number, row))

    duplicate_old = tuple(
        sorted(
            line_number
            for entries in old_by_key.values()
            if len(entries) > 1
            for line_number, _ in entries
        )
    )
    duplicate_new = tuple(
        sorted(
            line_number
            for entries in new_by_key.values()
            if len(entries) > 1
            for line_number, _ in entries
        )
    )
    ambiguous_keys = {
        row_key for row_key, entries in old_by_key.items() if len(entries) > 1
    } | {row_key for row_key, entries in new_by_key.items() if len(entries) > 1}

    old_unique = {
        row_key: entries[0]
        for row_key, entries in old_by_key.items()
        if len(entries) == 1 and row_key not in ambiguous_keys
    }
    new_unique = {
        row_key: entries[0]
        for row_key, entries in new_by_key.items()
        if len(entries) == 1 and row_key not in ambiguous_keys
    }

    only_old = tuple(
        line_number
        for row_key, (line_number, _) in old_unique.items()
        if row_key not in new_unique
    )
    only_new = tuple(
        line_number
        for row_key, (line_number, _) in new_unique.items()
        if row_key not in old_unique
    )

    common_headers_old_order = [
        header for header in old_headers if header in new_index
    ]
    common_headers_new_order = [
        header for header in new_headers if header in old_index
    ]
    reordered_count = sum(
        old_header != new_header
        for old_header, new_header in zip(
            common_headers_old_order, common_headers_new_order, strict=True
        )
    )

    changed_old: list[int] = []
    changed_new: list[int] = []
    matched_unchanged = 0
    for row_key, (old_line, old_row) in old_unique.items():
        new_entry = new_unique.get(row_key)
        if new_entry is None:
            continue
        new_line, new_row = new_entry
        is_changed = any(
            old_row[old_index[header]] != new_row[new_index[header]]
            for header in common_headers_old_order
        )
        if is_changed:
            changed_old.append(old_line)
            changed_new.append(new_line)
        else:
            matched_unchanged += 1

    findings: list[ComparisonFinding] = []
    added_columns = len(set(new_headers) - set(old_headers))
    removed_columns = len(set(old_headers) - set(new_headers))
    if added_columns:
        findings.append(ComparisonFinding("added_columns", "warning", added_columns))
    if removed_columns:
        findings.append(
            ComparisonFinding("removed_columns", "warning", removed_columns)
        )
    if reordered_count:
        findings.append(
            ComparisonFinding(
                "reordered_common_columns", "warning", reordered_count
            )
        )
    if missing_old:
        findings.append(
            ComparisonFinding(
                "missing_key_old", "error", len(missing_old), tuple(missing_old)
            )
        )
    if missing_new:
        findings.append(
            ComparisonFinding(
                "missing_key_new",
                "error",
                len(missing_new),
                new_rows=tuple(missing_new),
            )
        )
    if duplicate_old:
        findings.append(
            ComparisonFinding(
                "duplicate_key_old",
                "error",
                len(duplicate_old),
                old_rows=duplicate_old,
            )
        )
    if duplicate_new:
        findings.append(
            ComparisonFinding(
                "duplicate_key_new",
                "error",
                len(duplicate_new),
                new_rows=duplicate_new,
            )
        )
    if only_old:
        findings.append(
            ComparisonFinding("only_old", "warning", len(only_old), old_rows=only_old)
        )
    if only_new:
        findings.append(
            ComparisonFinding("only_new", "warning", len(only_new), new_rows=only_new)
        )
    if changed_old:
        findings.append(
            ComparisonFinding(
                "changed_record",
                "warning",
                len(changed_old),
                old_rows=tuple(changed_old),
                new_rows=tuple(changed_new),
            )
        )

    report = CsvComparisonReport(
        old_rows=len(old_rows),
        new_rows=len(new_rows),
        old_columns=len(old_headers),
        new_columns=len(new_headers),
        matched_unchanged=matched_unchanged,
        findings=tuple(findings),
    )
    lines = [
        "# CSV comparison report",
        "",
        f"- Old rows: {report.old_rows}",
        f"- New rows: {report.new_rows}",
        f"- Old columns: {report.old_columns}",
        f"- New columns: {report.new_columns}",
        f"- Matched unchanged rows: {report.matched_unchanged}",
        f"- Findings: {len(report.findings)}",
        "",
    ]
    if report.findings:
        lines.extend(
            [
                "| Check | Severity | Count | Old rows | New rows |",
                "| --- | --- | ---: | --- | --- |",
            ]
        )
        lines.extend(
            f"| {finding.code} | {finding.severity} | {finding.count} | "
            f"{_format_rows(finding.old_rows)} | {_format_rows(finding.new_rows)} |"
            for finding in report.findings
        )
    else:
        lines.append("No differences from the supported exact comparison.")
    lines.extend(
        [
            "",
            "The report contains counts and source row numbers only; it does not include source cell values.",
            "Duplicate or missing keys are not used for record matching.",
        ]
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return report
