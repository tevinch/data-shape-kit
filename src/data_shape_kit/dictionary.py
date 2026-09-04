"""Value-free Markdown data dictionaries for local CSV files."""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

from .clean import CsvShapeError, normalize_headers


@dataclass(frozen=True, slots=True)
class ColumnDictionary:
    name: str
    position: int
    non_empty: int
    empty: int
    distinct_non_empty: int
    observed_kind: str


@dataclass(frozen=True, slots=True)
class DictionaryReport:
    input_rows: int
    input_columns: int
    columns: tuple[ColumnDictionary, ...]


_INTEGER = re.compile(r"[+-]?(?:0|[1-9]\d*)")
_DECIMAL = re.compile(r"[+-]?(?:0|[1-9]\d*)\.\d+")


def _value_kind(value: str) -> str:
    lowered = value.casefold()
    if lowered in {"true", "false"}:
        return "boolean"
    if _INTEGER.fullmatch(value):
        return "integer"
    if _DECIMAL.fullmatch(value):
        return "decimal"
    if len(value) == 10:
        try:
            date.fromisoformat(value)
        except ValueError:
            pass
        else:
            return "date"
    if "T" in value:
        try:
            datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            pass
        else:
            return "datetime"
    return "text"


def _observed_kind(kinds: set[str]) -> str:
    if not kinds:
        return "empty"
    if len(kinds) == 1:
        return next(iter(kinds))
    return "mixed"


def write_dictionary(
    input_path: str | Path, output_path: str | Path
) -> DictionaryReport:
    """Write a Markdown data dictionary without including source cell values."""
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
            observed_kinds: list[set[str]] = [set() for _ in headers]
            input_rows = 0

            for line_number, raw_row in enumerate(reader, start=2):
                if len(raw_row) != len(headers):
                    raise CsvShapeError(
                        f"line {line_number} has {len(raw_row)} columns; expected {len(headers)}"
                    )
                input_rows += 1
                for index, raw_value in enumerate(raw_row):
                    value = raw_value.strip()
                    if not value:
                        empty_counts[index] += 1
                        continue
                    distinct_values[index].add(value)
                    observed_kinds[index].add(_value_kind(value))
    except csv.Error as error:
        raise CsvShapeError(f"invalid CSV: {error}") from error

    columns = tuple(
        ColumnDictionary(
            name=name,
            position=index + 1,
            non_empty=input_rows - empty_counts[index],
            empty=empty_counts[index],
            distinct_non_empty=len(distinct_values[index]),
            observed_kind=_observed_kind(observed_kinds[index]),
        )
        for index, name in enumerate(headers)
    )
    report = DictionaryReport(
        input_rows=input_rows,
        input_columns=len(headers),
        columns=columns,
    )

    lines = [
        "# CSV data dictionary",
        "",
        f"- Rows: {report.input_rows}",
        f"- Columns: {report.input_columns}",
        "",
        "| Position | Field | Observed kind | Non-empty | Empty | Distinct non-empty |",
        "| ---: | --- | --- | ---: | ---: | ---: |",
    ]
    lines.extend(
        "| "
        f"{column.position} | {column.name} | {column.observed_kind} | "
        f"{column.non_empty} | {column.empty} | {column.distinct_non_empty} |"
        for column in report.columns
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return report
