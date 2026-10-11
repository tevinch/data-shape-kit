"""Preserve list element types when using mypy 2.4.0."""

from collections.abc import Iterator
from typing import TypeVar

T = TypeVar("T")


def reverse_list(values: list[T]) -> Iterator[T]:
    return reversed(values)
