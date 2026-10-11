# Typed reverse iteration

mypy 2.4.0 can infer `Any` for `reversed(values)` when `values` is a list whose element type contains `Any`. In the [reported list-of-tuples example](https://github.com/python/mypy/issues/22174), this loses the known `int` type and makes `--warn-return-any` reject the function.

For this concrete list case, put the built-in call behind a generic function:

```python
from collections.abc import Iterator
from typing import TypeVar

T = TypeVar("T")

def reverse_list(values: list[T]) -> Iterator[T]:
    return reversed(values)
```

Then use `reverse_list(values)` in the original loop. [example.py](example.py) contains the complete function from the reported workflow, with that substitution. Copy [reverse_list.py](reverse_list.py) next to it, or put the helper in your own module.

The helper is checked once with `T`; its caller receives `Iterator[T]` without going through the ambiguous overload at the concrete nested-`Any` call site. It uses no cast or ignored error. At runtime it still calls Python's built-in `reversed`, preserving lazy traversal and list-subclass dispatch without copying or changing the input. See Python's [reversed documentation](https://docs.python.org/3.12/library/functions.html#reversed).

This is a local workaround for lists, not a mypy source fix or a replacement for every object accepted by `reversed`. The `Any` part stays `Any`. The upstream issue remains open as of October 11, 2026. Keeping mypy 2.3.1 is another option; a [downstream project used that version pin](https://github.com/withceleste/celeste-python/pull/494) to restore its checks.

## Run the checks

With Python 3.12, from this directory:

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install --only-binary=:all: mypy==2.4.0
.venv/bin/python check.py
```

The six scripted checks cover the original empty/single/multiple-item function, complete repeated reverse traversal, unchanged input, lazy reads, subclass dispatch, precise element types, and rejection of deliberately wrong input and return types. They also assert the original 2.4.0 failure, so an expected regression does not make the check command fail.

Verified with Python 3.12.14 and mypy 2.4.0, then with mypy 2.3.1 as a control. The control accepts the original function; both versions accept the workaround. These are programmatic checks, not confirmation from the original application owner.

The helper and checks are covered by the repository's [MIT license](../../LICENSE).

## Optional coffee

This example is free. If it saves you time and you would like to buy me a coffee, thank you. It is entirely optional.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
