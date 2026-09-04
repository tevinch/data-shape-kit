"""Privacy-preserving CSV profile summaries."""

from __future__ import annotations

import csv
import json
from dataclasses import asdict, dataclass
from pathlib import Path

from .clean import CsvShapeError, normalize_headers


@dataclass(frozen=True, slots=True)
class ColumnProfile:
    name: str
    empty: int
    distinct_non_empty: int


@dataclass(frozen=True, slots=True)
class ProfileReport:
    input_rows: int
    input_columns: int
    columns: tuple[ColumnProfile, ...]


def profile_csv(input_path: str | Path, output_path: str | Path) -> ProfileReport:
    """Write aggregate CSV shape counts without including source cell values."""
    source = Path(input_path)
    target = Path(output_path)
    if source.resolve() == target.resolve():
        raise CsvShapeError("input and output must be different files")

    try:
        with source.open(newline="", encoding="utf-8-sig") as handle:
            reader = csv.reader(handle, strict=True)
            try:
                raw_headers = next(reader)
            except StopIteration as error:
                raise CsvShapeError("expected a header row") from error

            headers = normalize_headers(raw_headers)
            empty_counts = [0] * len(headers)
            distinct_values: list[set[str]] = [set() for _ in headers]
            input_rows = 0
            for line_number, raw_row in enumerate(reader, start=2):
                if len(raw_row) != len(headers):
                    raise CsvShapeError(
                        f"line {line_number} has {len(raw_row)} columns; expected {len(headers)}"
                    )
                input_rows += 1
                for index, raw_value in enumerate(raw_row):
                    value = raw_value.strip()
                    if value:
                        distinct_values[index].add(value)
                    else:
                        empty_counts[index] += 1
    except csv.Error as error:
        raise CsvShapeError(f"invalid CSV: {error}") from error

    report = ProfileReport(
        input_rows=input_rows,
        input_columns=len(headers),
        columns=tuple(
            ColumnProfile(
                name=name,
                empty=empty_counts[index],
                distinct_non_empty=len(distinct_values[index]),
            )
            for index, name in enumerate(headers)
        ),
    )
    payload = {
        "columns": [asdict(column) for column in report.columns],
        "input_columns": report.input_columns,
        "input_rows": report.input_rows,
    }
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return report
