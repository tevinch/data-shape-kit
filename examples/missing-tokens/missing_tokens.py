"""Normalize explicitly configured missing-value tokens in CSV text."""

import csv
import io
from collections.abc import Collection, Mapping
from dataclasses import dataclass


@dataclass
class NormalizedCSV:
    text: str
    replacements: dict[str, int]
    row_count: int


def normalize_missing_csv(
    text: str,
    tokens_by_column: Mapping[str, Collection[str]],
    *,
    delimiter: str = ",",
) -> NormalizedCSV:
    """Replace exact, declared tokens with empty fields in selected columns."""
    if not isinstance(text, str):
        raise TypeError("text must be a string")
    if not isinstance(delimiter, str):
        raise TypeError("delimiter must be a string")
    if len(delimiter) != 1 or delimiter in {'"', "\r", "\n", "\0"}:
        raise ValueError("delimiter must be one permitted character")
    if not isinstance(tokens_by_column, Mapping):
        raise TypeError("tokens_by_column must be a mapping")

    copied_policy: dict[str, frozenset[str]] = {}
    for column, tokens in tokens_by_column.items():
        if not isinstance(column, str):
            raise TypeError("configured column names must be strings")
        if not column:
            raise ValueError("configured column names must not be empty")
        if not isinstance(tokens, (list, tuple, set, frozenset)):
            raise TypeError("tokens must be lists, tuples, sets, or frozensets")
        if any(not isinstance(token, str) for token in tokens):
            raise TypeError("every missing-value token must be a string")
        copied_policy[column] = frozenset(tokens)

    if text.startswith("\ufeff"):
        text = text[1:]

    reader = csv.reader(
        io.StringIO(text, newline=""),
        delimiter=delimiter,
        strict=True,
    )
    rows = list(reader)
    if not rows or not rows[0]:
        raise ValueError("CSV input must contain a header")

    headers = rows[0]
    if any(header == "" for header in headers):
        raise ValueError("header names must not be empty")
    if len(set(headers)) != len(headers):
        raise ValueError("header names must be unique")

    header_indexes = {header: index for index, header in enumerate(headers)}
    unknown_columns = copied_policy.keys() - header_indexes.keys()
    if unknown_columns:
        raise ValueError("configured columns must exactly match header names")

    data_rows = rows[1:]
    for row in data_rows:
        if len(row) != len(headers):
            raise ValueError("data record width differs from header")

    replacements = {column: 0 for column in copied_policy}
    indexed_policy = [
        (header_indexes[column], column, tokens)
        for column, tokens in copied_policy.items()
    ]
    for row in data_rows:
        for column_index, column, tokens in indexed_policy:
            if row[column_index] and row[column_index] in tokens:
                row[column_index] = ""
                replacements[column] += 1

    output = io.StringIO(newline="")
    writer = csv.writer(output, delimiter=delimiter, lineterminator="\r\n")
    writer.writerows(rows)
    return NormalizedCSV(
        text=output.getvalue(),
        replacements=replacements,
        row_count=len(data_rows),
    )
