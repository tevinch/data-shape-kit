"""Deterministic, local-only CSV cleanup."""

from __future__ import annotations

import csv
import re
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path


class CsvShapeError(ValueError):
    """Raised when a CSV cannot be cleaned without guessing its shape."""


@dataclass(frozen=True, slots=True)
class CleanReport:
    input_rows: int
    output_rows: int
    duplicates_removed: int
    columns: int


def normalize_headers(headers: Sequence[str]) -> list[str]:
    """Return lowercase, underscore-separated, unique column names."""
    if not headers:
        raise CsvShapeError("expected a header row with at least one column")

    counts: dict[str, int] = {}
    normalized: list[str] = []
    for index, header in enumerate(headers, start=1):
        base = re.sub(r"[^\w]+", "_", header.strip().lower(), flags=re.UNICODE)
        base = re.sub(r"_+", "_", base).strip("_") or f"column_{index}"
        counts[base] = counts.get(base, 0) + 1
        suffix = counts[base]
        normalized.append(base if suffix == 1 else f"{base}_{suffix}")
    return normalized


def clean_csv(input_path: str | Path, output_path: str | Path) -> CleanReport:
    """Clean a CSV locally and return row-level statistics."""
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
            rows: list[tuple[str, ...]] = []
            seen: set[tuple[str, ...]] = set()
            input_rows = 0
            for line_number, raw_row in enumerate(reader, start=2):
                if len(raw_row) != len(headers):
                    raise CsvShapeError(
                        f"line {line_number} has {len(raw_row)} columns; expected {len(headers)}"
                    )
                input_rows += 1
                row = tuple(cell.strip() for cell in raw_row)
                if row not in seen:
                    seen.add(row)
                    rows.append(row)
    except csv.Error as error:
        raise CsvShapeError(f"invalid CSV: {error}") from error

    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(headers)
        writer.writerows(rows)

    output_rows = len(rows)
    return CleanReport(
        input_rows=input_rows,
        output_rows=output_rows,
        duplicates_removed=input_rows - output_rows,
        columns=len(headers),
    )
