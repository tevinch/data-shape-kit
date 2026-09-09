"""Parse explicitly formatted decimal text without guessing or binary floats."""

# Copyright (c) 2026 Tevinch. SPDX-License-Identifier: MIT

from decimal import Decimal
import re


def parse_decimal_text(
    text: str, *, decimal_mark: str, group_mark: str | None = None
) -> Decimal:
    """Return an exact Decimal from the documented, explicitly selected grammar.

    Raises TypeError for non-string input and ValueError for invalid options,
    malformed numbers, or strings longer than 256 characters. Error messages
    omit the input. No global locale or decimal context is changed.
    """
    if not isinstance(decimal_mark, str) or decimal_mark not in ('.', ','):
        raise ValueError('Choose a dot or comma decimal mark.')
    if group_mark is not None and (
        not isinstance(group_mark, str)
        or group_mark not in ('.', ',', ' ', '\u00a0', '\u202f')
        or group_mark == decimal_mark
    ):
        raise ValueError('Choose a supported grouping mark distinct from the decimal mark.')
    if not isinstance(text, str):
        raise TypeError('Expected a text value.')
    if len(text) > 256:
        raise ValueError('Value exceeds the 256-character limit.')

    value = text.strip(' \u00a0\u202f')
    sign = ''
    if value.startswith(('+', '-')):
        sign, value = value[0], value[1:]
    parts = value.split(decimal_mark)
    if len(parts) > 2 or (len(parts) == 2 and not re.fullmatch(r'[0-9]+', parts[1])):
        raise ValueError('Invalid decimal fraction for the selected format.')

    integer = parts[0]
    if group_mark is not None and group_mark in integer:
        groups = integer.split(group_mark)
        if not re.fullmatch(r'[0-9]{1,3}', groups[0]) or any(
            not re.fullmatch(r'[0-9]{3}', group) for group in groups[1:]
        ):
            raise ValueError('Invalid three-digit grouping for the selected format.')
        integer = ''.join(groups)
    elif not re.fullmatch(r'[0-9]+', integer):
        raise ValueError('Invalid integer digits for the selected format.')

    fraction = '.' + parts[1] if len(parts) == 2 else ''
    return Decimal(sign + integer + fraction)
