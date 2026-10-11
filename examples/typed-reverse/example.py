"""The list-of-tuples workflow from python/mypy issue 22174."""

from typing import Any

from reverse_list import reverse_list


def foo(values: list[tuple[Any, int]]) -> int | None:
    for key, value in reverse_list(values):
        return value
    return None
