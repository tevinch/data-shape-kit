"""Existing module logs stay above the updating progress display."""

import logging
from time import sleep

from rich.console import Console
from rich.progress import BarColumn, Progress, TaskProgressColumn, TextColumn

from demo_sources import stderr_source, stdout_source
from live_log_streams import live_log_streams


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="ROOT %(message)s")
    console = Console(stderr=True)
    with Progress(TextColumn("Processing"), BarColumn(), TaskProgressColumn(),
                  console=console) as progress:
        with live_log_streams():
            task = progress.add_task("Processing", total=5)
            for step in range(5):
                message = f"step-{step} [bold]literal[/bold]"
                logging.info(message)
                stdout_source.report(message)
                stderr_source.report(message)
                sleep(0.08)
                progress.advance(task)
    logging.info("finished; original logging streams restored")


if __name__ == "__main__":
    main()
