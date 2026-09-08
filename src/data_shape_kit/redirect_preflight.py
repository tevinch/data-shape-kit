"""Value-free static checks for site-migration redirect map CSV files."""

from __future__ import annotations

import csv
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit

from .clean import CsvShapeError


@dataclass(frozen=True, slots=True)
class RedirectFinding:
    code: str
    severity: str
    count: int
    rows: tuple[int, ...]


@dataclass(frozen=True, slots=True)
class RedirectPreflightReport:
    input_rows: int
    input_columns: int
    findings: tuple[RedirectFinding, ...]


def _value(row: list[str], index: int | None) -> str:
    return row[index].strip() if index is not None else ""


def _valid_public_url(value: str) -> bool:
    if not value or len(value) > 2048 or any(character.isspace() for character in value):
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
        and parsed.fragment == ""
        and (port is None or 0 < port <= 65535)
    )


def _append(bucket: dict[str, list[int]], code: str, row: int) -> None:
    bucket.setdefault(code, []).append(row)


def _cycle_rows(
    relation: dict[str, str], source_rows: dict[str, int]
) -> tuple[int, ...]:
    cycle_rows: set[int] = set()
    complete: set[str] = set()
    for start in relation:
        if start in complete:
            continue
        path: list[str] = []
        positions: dict[str, int] = {}
        current = start
        while current in relation and current not in complete:
            if current in positions:
                cycle = path[positions[current] :]
                if len(cycle) > 1:
                    cycle_rows.update(source_rows[node] for node in cycle)
                break
            positions[current] = len(path)
            path.append(current)
            current = relation[current]
        complete.update(path)
    return tuple(sorted(cycle_rows))


def preflight_redirect_map(
    input_path: str | Path, output_path: str | Path
) -> RedirectPreflightReport:
    """Write static redirect-map findings without including source cell values."""
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

            rows: list[tuple[int, list[str]]] = []
            for line_number, row in enumerate(reader, start=2):
                if len(row) != len(headers):
                    raise CsvShapeError(
                        f"line {line_number} has {len(row)} columns; expected {len(headers)}"
                    )
                rows.append((line_number, row))
    except UnicodeDecodeError as error:
        raise CsvShapeError("expected a UTF-8 CSV file") from error
    except csv.Error as error:
        raise CsvShapeError(f"invalid CSV: {error}") from error

    header_findings: list[RedirectFinding] = []

    def required_header(name: str, code_stem: str) -> int | None:
        count = headers.count(name)
        if count == 0:
            header_findings.append(
                RedirectFinding(f"missing_{code_stem}_header", "error", 1, ())
            )
            return None
        if count > 1:
            header_findings.append(
                RedirectFinding(
                    f"duplicate_{code_stem}_header", "error", count, ()
                )
            )
            return None
        return headers.index(name)

    source_index = required_header("Source URL", "source_url")
    target_index = required_header("Target URL", "target_url")
    status_index = required_header("Status Code", "status_code")

    buckets: dict[str, list[int]] = {}
    source_entries: defaultdict[str, list[tuple[int, str]]] = defaultdict(list)
    valid_entries: list[tuple[int, str, str]] = []
    for line_number, row in rows:
        source_url = _value(row, source_index)
        target_url = _value(row, target_index)
        status_code = _value(row, status_index)

        source_is_valid = False
        target_is_valid = False
        if source_index is not None:
            if not source_url:
                _append(buckets, "missing_source_url", line_number)
            elif not _valid_public_url(source_url):
                _append(buckets, "invalid_source_url", line_number)
            else:
                source_is_valid = True
            if source_url:
                source_entries[source_url].append((line_number, target_url))

        if target_index is not None:
            if not target_url:
                _append(buckets, "missing_target_url", line_number)
            elif not _valid_public_url(target_url):
                _append(buckets, "invalid_target_url", line_number)
            else:
                target_is_valid = True

        if status_index is not None and status_code not in {"301", "308"}:
            _append(buckets, "unsupported_status_code", line_number)
        if source_is_valid and target_is_valid:
            valid_entries.append((line_number, source_url, target_url))

    duplicate_sources: set[str] = set()
    conflicting_sources: set[str] = set()
    for source_url, entries in source_entries.items():
        if len(entries) < 2:
            continue
        targets = {target_url for _, target_url in entries}
        rows_for_source = [line_number for line_number, _ in entries]
        if len(targets) == 1:
            duplicate_sources.add(source_url)
            buckets.setdefault("duplicate_source", []).extend(rows_for_source)
        else:
            conflicting_sources.add(source_url)
            buckets.setdefault("conflicting_source", []).extend(rows_for_source)

    relation: dict[str, str] = {}
    relation_rows: dict[str, int] = {}
    for line_number, source_url, target_url in valid_entries:
        if (
            source_url in duplicate_sources
            or source_url in conflicting_sources
            or source_url == target_url
        ):
            continue
        relation[source_url] = target_url
        relation_rows[source_url] = line_number

    for line_number, source_url, target_url in valid_entries:
        if source_url == target_url:
            _append(buckets, "self_redirect", line_number)
        elif source_url in relation and target_url in relation:
            _append(buckets, "redirect_chain", line_number)

    cycles = _cycle_rows(relation, relation_rows)
    if cycles:
        buckets["redirect_cycle"] = list(cycles)

    target_sources: defaultdict[str, list[tuple[int, str]]] = defaultdict(list)
    for line_number, source_url, target_url in valid_entries:
        target_sources[target_url].append((line_number, source_url))
    for entries in target_sources.values():
        if len({source_url for _, source_url in entries}) > 1:
            buckets.setdefault("shared_target", []).extend(
                line_number for line_number, _ in entries
            )

    ordered_codes = (
        ("missing_source_url", "error"),
        ("missing_target_url", "error"),
        ("invalid_source_url", "error"),
        ("invalid_target_url", "error"),
        ("unsupported_status_code", "error"),
        ("duplicate_source", "warning"),
        ("conflicting_source", "error"),
        ("self_redirect", "error"),
        ("redirect_chain", "warning"),
        ("redirect_cycle", "error"),
        ("shared_target", "warning"),
    )
    findings = list(header_findings)
    for code, severity in ordered_codes:
        finding_rows = tuple(sorted(set(buckets.get(code, []))))
        if finding_rows:
            findings.append(
                RedirectFinding(code, severity, len(finding_rows), finding_rows)
            )

    report = RedirectPreflightReport(
        input_rows=len(rows),
        input_columns=len(headers),
        findings=tuple(findings),
    )
    lines = [
        "# Redirect map preflight",
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
        lines.append("No findings from the supported static checks.")
    lines.extend(
        [
            "",
            "This report covers supported static checks only and does not make network requests.",
            "It does not include source cell values and does not guarantee search performance.",
        ]
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return report
