# Existing logging above Rich progress

Keep preconfigured standard-library logs readable above one updating Rich
progress bar, including handlers owned by imported modules. This example keeps
each handler's formatter, filters and level, and each logger's propagation
settings. It restores the exact stream references when the scope ends.

Tested with **CPython 3.12.4 and Rich 15.0.0** on macOS. This is a small
application-side recipe, not a Rich patch. It uses CPython's logging registry
and Rich's `FileProxy.rich_proxied_file` property, both version-sensitive
implementation details. Run the included tests before using another version.

## Run the example

From this directory:

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install --index-url https://pypi.org/simple \
  --only-binary=:all: --require-hashes -r requirements.txt
.venv/bin/python example.py
```

The example imports two modules with separate stdout/stderr handlers, then
starts progress. Fifteen formatted messages appear above one bar that reaches
100%. A final log is emitted after the original streams are restored.
`requirements.txt` pins Rich and its dependencies to verified PyPI wheel hashes.

## Use it in an application

Copy `live_log_streams.py` beside your application. Complete imports and logging
configuration **before starting Progress or Live**. Enter the helper inside the
display's context, and leave it before the display stops:

```python
from rich.progress import Progress
from live_log_streams import live_log_streams

# Import libraries and configure logging here.
with Progress() as progress:
    with live_log_streams():
        task = progress.add_task("Working", total=10)
        for item in range(10):
            do_work(item)  # Existing module logging can continue.
            progress.advance(task)
```

Discovery includes root and registered named loggers, even deeply dotted names
whose parent loggers do not exist. `Logger.getChildren()` alone misses that last
case. Shared handlers are rebound once. Nested helper scopes inside the same
active display leave the outer binding intact.

Only exact `logging.StreamHandler` instances with the standard `"\n"` terminator
pointing to the **actual terminal stream currently wrapped by Rich** are changed.
Other terminators are skipped because Rich's buffered flush can change their
literal content or add a newline. File handlers, custom handler
subclasses, RichHandler, unrelated files and pipes are left alone. Streams are
matched by object identity; equal file descriptors do not establish ownership.
Disabled stdout/stderr redirection stays disabled. Custom handlers may still
disrupt a live display if they independently write to its terminal.
If stdout and stderr share the same stream object and either channel remains
unredirected, the shared destination is skipped: its identity cannot tell which
channel a handler intended to use. Those ambiguous handlers may also disrupt
the display.

For a stdout data pipeline, direct progress to `Console(stderr=True)` and set
`redirect_stdout=False` on Progress/Live. Existing stdout logging handlers keep
their pipe destination, including when Rich's default stdout redirection is on;
ordinary `print()` still follows Rich's own redirection setting.

If a later handler explicitly uses a **saved original terminal stream**, call
the yielded `refresh()` before that handler emits. This narrow refresh is not
a logging-configuration lifecycle manager. A default `StreamHandler()` created
while Rich is active captures Rich's proxy and is not managed by this helper.
Configure those handlers before starting the display, or manage their streams
yourself. Intentional stream changes are preserved; if you change a handler to
another active Rich proxy, restore that change yourself before Rich exits.

Threads may emit through existing handlers. Do not concurrently add/remove
handlers, change logger configuration, or replace stdout/stderr while this
scope is active. Separate or nested Live displays, notebooks and custom stream
wrappers are outside the tested scope. If a stream flush fails during cleanup,
remaining handlers still get a restoration attempt and an `ExceptionGroup`
reports the failures; a body exception remains chained to that group.

## Checks

The complete test suite needs a Unix PTY (macOS/Linux) and the additional
terminal-parser dependencies:

```sh
.venv/bin/python -m pip install --index-url https://pypi.org/simple \
  --only-binary=:all: --require-hashes -r requirements-test.txt
.venv/bin/python -m unittest -v
```

The tests exercise real imported-module handlers and worker-thread logging in
a PTY. An independent terminal parser checks exact visible log rows, intermediate
progress percentages, one completed bar per run, a second run, exception
restoration and actual logging after exit. Separate checks cover filters/levels,
files/custom pipes, disabled redirection, JSONL stdout and cleanup failures.
These are scripted checks against the versions listed above.

Background: [Rich issue 4235](https://github.com/Textualize/rich/issues/4235),
[Rich progress redirection](https://rich.readthedocs.io/en/latest/progress.html#redirecting-stdout-stderr),
and [Python logging](https://docs.python.org/3.12/library/logging.html).
The source and example are available under the repository's MIT license.

## Optional coffee

This solution is free. If it saved you time, you can optionally buy me a coffee:

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
