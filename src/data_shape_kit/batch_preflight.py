"""Value-free structural checks for a directory of CSV files."""

from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path

from .clean import CsvShapeError


@dataclass(frozen=True, slots=True)
class BatchFinding:
    code: str
    severity: str
    count: int
    files: tuple[int, ...] = ()
    locations: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class BatchPreflightReport:
    file_count: int
    input_rows: int
    schema_groups: int
    findings: tuple[BatchFinding, ...]


def _ordered_csv_files(source: Path, target: Path) -> list[Path]:
    target_path = target.resolve()
    return sorted(
        (
            path
            for path in source.iterdir()
            if path.is_file()
            and path.suffix.lower() == ".csv"
            and path.resolve() != target_path
        ),
        key=lambda path: (path.name.casefold(), path.name),
    )


def preflight_csv_batch(
    input_path: str | Path, output_path: str | Path
) -> BatchPreflightReport:
    """Write batch shape findings without file names, headers, or cell values."""
    source = Path(input_path)
    target = Path(output_path)
    if source.resolve() == target.resolve():
        raise CsvShapeError("input and output must be different paths")
    if not source.is_dir():
        raise CsvShapeError("input must be a directory")

    files = _ordered_csv_files(source, target)
    if not files:
        raise CsvShapeError("expected at least one CSV file")

    affected_files: dict[str, set[int]] = {}
    locations: dict[str, list[str]] = {}
    counts: dict[str, int] = {}
    schemas: list[tuple[int, tuple[str, ...]]] = []
    input_rows = 0

    def record(code: str, file_number: int, location: str | None = None) -> None:
        counts[code] = counts.get(code, 0) + 1
        affected_files.setdefault(code, set()).add(file_number)
        if location is not None:
            locations.setdefault(code, []).append(location)

    for file_number, path in enumerate(files, start=1):
        try:
            with path.open(newline="", encoding="utf-8-sig") as handle:
                reader = csv.reader(handle, strict=True)
                try:
                    headers = next(reader)
                except StopIteration:
                    record("missing_header", file_number)
                    continue
                except csv.Error:
                    record(
                        "invalid_csv",
                        file_number,
                        f"F{file_number}:R{max(reader.line_num, 1)}",
                    )
                    continue

                if not headers:
                    record("missing_header", file_number)
                    continue

                blank_header = any(not header.strip() for header in headers)
                duplicate_header = len(set(headers)) != len(headers)
                if blank_header:
                    record("blank_header", file_number)
                if duplicate_header:
                    record("duplicate_header", file_number)
                if headers and not blank_header and not duplicate_header:
                    schemas.append((file_number, tuple(headers)))

                try:
                    for row in reader:
                        input_rows += 1
                        if len(row) != len(headers):
                            record(
                                "malformed_row",
                                file_number,
                                f"F{file_number}:R{reader.line_num}",
                            )
                except csv.Error:
                    record(
                        "invalid_csv",
                        file_number,
                        f"F{file_number}:R{max(reader.line_num, 1)}",
                    )
        except UnicodeDecodeError:
            record("invalid_utf8", file_number)

    schema_groups = len({schema for _, schema in schemas})
    if schemas:
        baseline = schemas[0][1]
        for file_number, schema in schemas[1:]:
            if schema != baseline:
                record("schema_mismatch", file_number)

    ordered_codes = (
        ("missing_header", "error"),
        ("invalid_utf8", "error"),
        ("blank_header", "error"),
        ("duplicate_header", "error"),
        ("schema_mismatch", "warning"),
        ("malformed_row", "error"),
        ("invalid_csv", "error"),
    )
    findings = tuple(
        BatchFinding(
            code=code,
            severity=severity,
            count=counts[code],
            files=tuple(sorted(affected_files[code])),
            locations=tuple(locations.get(code, ())),
        )
        for code, severity in ordered_codes
        if code in counts
    )
    report = BatchPreflightReport(
        file_count=len(files),
        input_rows=input_rows,
        schema_groups=schema_groups,
        findings=findings,
    )

    lines = [
        "# CSV batch preflight",
        "",
        f"- Files: {report.file_count}",
        f"- Rows: {report.input_rows}",
        f"- Schema groups: {report.schema_groups}",
        f"- Findings: {len(report.findings)}",
        "",
    ]
    if report.findings:
        lines.extend(
            [
                "| Check | Severity | Count | Files | Locations |",
                "| --- | --- | ---: | --- | --- |",
            ]
        )
        lines.extend(
            f"| {finding.code} | {finding.severity} | {finding.count} | "
            f"{', '.join(str(number) for number in finding.files) or '-'} | "
            f"{', '.join(finding.locations) or '-'} |"
            for finding in report.findings
        )
    else:
        lines.append("No findings from the supported local checks.")
    lines.extend(
        [
            "",
            "The scan covers immediate CSV files only and does not read subdirectories.",
            "The report does not include file names, header names, or source cell values.",
            "It does not combine or modify files.",
        ]
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return report
