"""Small subprocess fixture for real terminal and pipeline checks."""

from contextlib import nullcontext
import json
import logging
import sys
from threading import Thread

from rich.console import Console
from rich.progress import BarColumn, Progress

from demo_sources import stderr_source, stdout_source
from live_log_streams import live_log_streams


def main(mode: str) -> None:
    root_handler = logging.StreamHandler(sys.stderr)
    root_handler.setFormatter(logging.Formatter("ROOT %(message)s"))
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.addHandler(root_handler)
    handlers = root_handler, stdout_source.handler, stderr_source.handler
    originals = tuple(handler.stream for handler in handlers)
    console = Console(stderr=True, color_system=None, width=90)

    if mode in ("pipe", "pipe-default"):
        stdout_source.handler.setFormatter(logging.Formatter("%(message)s"))
        with Progress("Work {task.percentage:3.0f}%", BarColumn(bar_width=20), console=console,
                      redirect_stdout=(mode == "pipe-default"),
                      auto_refresh=False) as progress:
            with live_log_streams():
                task = progress.add_task("Work", total=2)
                for value in range(2):
                    stdout_source.logger.info(json.dumps({"item": value}))
                    stderr_source.report(f"pipe-step-{value}")
                    progress.advance(task)
                    progress.refresh()
        assert stdout_source.handler.stream is originals[1]
        return

    observations = []
    original_filter = stdout_source.handler.filters[0]

    def observe_filter(record):
        accepted = original_filter(record)
        observations.append([record.getMessage(), accepted])
        return accepted

    stdout_source.handler.removeFilter(original_filter)
    stdout_source.handler.addFilter(observe_filter)

    for run in range(1, 3):
        with Progress(f"Run-{run} {{task.percentage:3.0f}}%", BarColumn(bar_width=20), console=console,
                      auto_refresh=False) as progress:
            with (nullcontext() if mode == "unadapted" else live_log_streams()):
                task = progress.add_task("Work", total=5)
                for step in range(5):
                    message = f"run-{run}:step-{step} [bold]literal[/bold]"

                    def report():
                        root.info(message)
                        stdout_source.report(message)
                        stderr_source.report(message)

                    # The worker emits through the real, preconfigured handlers.
                    worker = Thread(target=report)
                    worker.start()
                    progress.refresh()
                    worker.join(timeout=5)
                    assert not worker.is_alive()
                    progress.advance(task)
                    progress.refresh()
                assert progress.tasks[0].completed == 5
        assert all(handler.stream is stream for handler, stream in zip(handlers, originals))
        root.info(f"after-run-{run}")
        stdout_source.report(f"after-run-{run}")
        stderr_source.report(f"after-run-{run}")

    try:
        with Progress("Interrupted {task.percentage:3.0f}%", console=console,
                      transient=True, auto_refresh=False) as progress:
            with live_log_streams():
                task = progress.add_task("Work", total=1)
                root.info("before-exception")
                raise RuntimeError("expected interruption")
    except RuntimeError:
        pass
    assert all(handler.stream is stream for handler, stream in zip(handlers, originals))
    root.info("after-exception")
    stdout_source.report("after-exception")
    stderr_source.report("after-exception")
    print("COMPLETE: two tasks reached 100%; streams restored")
    print("FILTER OBSERVATIONS " + json.dumps(observations))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "adapted")
