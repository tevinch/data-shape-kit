"""Prepare already structured CSL JSON family names for Pandoc.

Python 3.10+, standard library only. See README.md for the input contract.
"""

import argparse
import copy
from decimal import Decimal
import json
import os
from pathlib import Path
import tempfile


NAME_FIELDS = frozenset("""
author chair collection-editor compiler composer container-author contributor
curator director editor editorial-director executive-producer guest host
illustrator interviewer narrator organizer original-author performer producer
recipient reviewed-author script-writer series-creator translator
""".split())


def prepare_bibliography(items):
    """Return a copy whose structured family names resist particle extraction.

    Explicit non-dropping particles and literal names take precedence. This
    does not decide how a name ought to be divided into parts.
    """
    if not isinstance(items, list):
        raise ValueError("expected a CSL JSON array of references")
    result = copy.deepcopy(items)
    for index, item in enumerate(result):
        if not isinstance(item, dict):
            raise ValueError(f"reference {index + 1} must be an object")
        for field in NAME_FIELDS.intersection(item):
            names = item[field]
            if not isinstance(names, list):
                raise ValueError(f"reference {index + 1}: {field} must be an array")
            for name in names:
                if not isinstance(name, dict):
                    raise ValueError(f"reference {index + 1}: {field} must contain objects")
                family = name.get("family")
                if family is not None and not isinstance(family, str):
                    raise ValueError(f"reference {index + 1}: family must be a string")
                # Pandoc already skips extraction when this particle is set,
                # even to an empty string. Adding quotes then would print them.
                if name.get("literal") is not None or name.get("non-dropping-particle") is not None:
                    continue
                if family and not (family.startswith('"') and family.endswith('"')):
                    name["family"] = '"' + family + '"'
    return result


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def _reject_constant(value):
    raise ValueError(f"not a JSON number: {value}")


def _json_text(value, level=0):
    """Serialize decimals without rounding custom metadata through a float."""
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (dict, list)) and value:
        indent = "  " * (level + 1)
        if isinstance(value, dict):
            parts = [json.dumps(key, ensure_ascii=False) + ": " + _json_text(item, level + 1)
                     for key, item in value.items()]
            start, end = "{", "}"
        else:
            parts = [_json_text(item, level + 1) for item in value]
            start, end = "[", "]"
        return start + "\n" + indent + (",\n" + indent).join(parts) + "\n" + "  " * level + end
    return json.dumps(value, ensure_ascii=False, allow_nan=False)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("input", type=Path, help="already structured CSL JSON export")
    parser.add_argument("output", type=Path, help="separate derived file; replaced on each successful run")
    args = parser.parse_args()
    temporary = None
    try:
        if args.input.resolve() == args.output.resolve() or (
            args.output.exists() and args.input.samefile(args.output)
        ):
            raise ValueError("input and output must be different files")
        if args.output.is_symlink():
            raise ValueError("output must not be a symbolic link")
        items = json.loads(args.input.read_text(encoding="utf-8-sig"),
                           object_pairs_hook=_unique_object, parse_float=Decimal,
                           parse_constant=_reject_constant)
        content = _json_text(prepare_bibliography(items)) + "\n"
        # Complete validation before opening an output. Replace only after the
        # whole derived bibliography has been written successfully.
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", newline="\n",
                                         dir=args.output.parent, delete=False) as output:
            temporary = Path(output.name)
            output.write(content)
        os.replace(temporary, args.output)
        temporary = None
    except (OSError, ValueError, UnicodeError, RecursionError) as error:
        parser.exit(2, f"{parser.prog}: {error}\n")
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
