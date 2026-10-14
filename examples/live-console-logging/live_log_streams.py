"""Temporary routing for ordinary console StreamHandlers during Rich Live.

Tested with CPython 3.12 and Rich 15.0.0. Logger discovery reads CPython's
logging registry, an implementation detail; it does not change that registry.
"""

from contextlib import contextmanager
import logging
import sys
from typing import Callable, Iterator

from rich.file_proxy import FileProxy


@contextmanager
def live_log_streams() -> Iterator[Callable[[], int]]:
    """Enter *inside* an active Progress/Live; exit before that display stops.

    Only exact stdlib StreamHandlers with the standard newline terminator,
    whose stream is the terminal file wrapped by a current Rich stdout/stderr
    proxy, are rebound. Yield a refresh function
    for later handlers explicitly using a saved original terminal stream,
    called before their first logging emission. Handlers created with a current
    Rich proxy as their stream are not managed by this context.
    Do not change logging configuration concurrently with this scope.
    """
    bindings = {}

    def refresh() -> int:
        streams = sys.stdout, sys.stderr
        unredirected = [stream for stream in streams if not isinstance(stream, FileProxy)]
        proxies = [
            stream for stream in streams
            if isinstance(stream, FileProxy)
            and stream.rich_proxied_file.isatty()
            and all(stream.rich_proxied_file is not raw for raw in unredirected)
        ]
        root = logging.getLogger()
        # getChildren() misses dotted names when parents are only PlaceHolders.
        # Snapshot the full registry; skip those non-Logger placeholders.
        loggers = [root, *tuple(root.manager.loggerDict.values())]
        seen = set()
        changed = 0
        for logger in loggers:
            if not isinstance(logger, logging.Logger):
                continue
            for handler in tuple(logger.handlers):
                if (type(handler) is not logging.StreamHandler
                        or handler.terminator != "\n"
                        or handler in seen or handler in bindings):
                    continue
                seen.add(handler)
                handler.acquire()
                try:
                    for proxy in proxies:
                        if handler.stream is proxy.rich_proxied_file:
                            original = handler.setStream(proxy)
                            bindings[handler] = original, proxy
                            changed += 1
                            break
                finally:
                    handler.release()
        return changed

    try:
        refresh()
        yield refresh
    finally:
        errors = []
        for handler, (original, proxy) in reversed(tuple(bindings.items())):
            handler.acquire()
            try:
                # Retain an intentional setStream() change made by the app.
                if handler.stream is proxy:
                    handler.setStream(original)
            except Exception as error:
                errors.append(error)
            finally:
                handler.release()
        if errors:
            # An exception from the body remains in this group's __context__.
            raise ExceptionGroup("Could not restore logging streams", errors)
