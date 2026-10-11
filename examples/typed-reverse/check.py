"""Run with Python 3.12 and mypy 2.4.0 (or the 2.3.1 control)."""

import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from example import foo
from reverse_list import reverse_list


HERE = Path(__file__).resolve().parent


def check_types(source):
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "case.py"
        path.write_text(source)
        return subprocess.run(
            [sys.executable, "-m", "mypy", "--no-incremental", "--cache-dir", os.devnull, "--python-version", "3.12", "--warn-return-any", "--strict", str(path)],
            cwd=HERE,
            env={**os.environ, "MYPYPATH": str(HERE)},
            text=True,
            capture_output=True,
            check=False,
        )


class RuntimeChecks(unittest.TestCase):
    def test_original_function_empty_single_and_multiple_items(self):
        for values, expected in [([], None), ([("a", 7)], 7), ([(None, 10), ({"id": 2}, 20), (object(), 30)], 30)]:
            with self.subTest(expected=expected):
                before = values.copy()
                self.assertEqual(foo(values), expected)
                self.assertEqual(values, before)

    def test_full_traversal_repeated_and_lazy(self):
        values = [("a", 10), ("b", 20), ("c", 30)]
        for _ in range(2):
            self.assertEqual(list(reverse_list(values)), [("c", 30), ("b", 20), ("a", 10)])
            self.assertEqual(values, [("a", 10), ("b", 20), ("c", 30)])
        iterator = reverse_list(values)
        values[2] = ("c", 40)
        self.assertEqual(next(iterator), ("c", 40))

    def test_builtin_subclass_dispatch_is_preserved(self):
        class CustomList(list):
            calls = 0

            def __reversed__(self):
                self.calls += 1
                return iter([("custom", 99)])

        values = CustomList([("a", 1)])
        # Special-method lookup by reversed() ignores an instance shadow.
        values.__reversed__ = lambda: iter([("shadow", 0)])
        self.assertEqual(list(reverse_list(values)), [("custom", 99)])
        self.assertEqual(values.calls, 1)
        self.assertEqual(values, [("a", 1)])


class TypingChecks(unittest.TestCase):
    def test_original_regression_control(self):
        version = subprocess.check_output([sys.executable, "-m", "mypy", "--version"], text=True)
        self.assertTrue(version.startswith(("mypy 2.4.0", "mypy 2.3.1")), version)
        result = check_types('''from typing import Any
def foo(values: list[tuple[Any, int]]) -> int | None:
    for key, value in reversed(values):
        reveal_type(value)
        return value
    return None
''')
        if version.startswith("mypy 2.4.0"):
            self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
            self.assertIn('Revealed type is "Any"', result.stdout)
            self.assertIn('[no-any-return]', result.stdout)
        else:
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertIn('Revealed type is "int"', result.stdout)

    def test_original_flow_and_nested_types_remain_precise(self):
        result = check_types('''from collections.abc import Iterator
from typing import Any, assert_type
from reverse_list import reverse_list
from example import foo
pairs: list[tuple[Any, int]] = [(None, 1)]
assert_type(reverse_list(pairs), Iterator[tuple[Any, int]])
for key, value in reverse_list(pairs):
    assert_type(key, Any)
    assert_type(value, int)
assert_type(foo(pairs), int | None)
records: list[dict[str, Any]] = [{"x": 1}]
assert_type(reverse_list(records), Iterator[dict[str, Any]])
''')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_actual_type_errors_are_rejected(self):
        result = check_types('''from typing import Any
from reverse_list import reverse_list
from example import foo
foo([(None, "wrong")])
def wrong_return(values: list[tuple[Any, int]]) -> str | None:
    for key, value in reverse_list(values):
        return value
    return None
''')
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn('[list-item]', result.stdout)
        self.assertIn('[return-value]', result.stdout)
        self.assertNotIn('[no-any-return]', result.stdout)


if __name__ == "__main__":
    unittest.main(verbosity=2)
