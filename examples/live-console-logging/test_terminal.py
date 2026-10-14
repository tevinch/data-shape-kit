"""Independent terminal parsing of the complete logged progress workflow."""

import errno
import fcntl
import json
import os
from pathlib import Path
import pty
import re
import select
import struct
import subprocess
import sys
import termios
import unittest

import pyte


FOLDER = Path(__file__).resolve().parent


def run_terminal(script="terminal_scenario.py", mode="adapted", pipe_stdout=False):
    master, slave = pty.openpty()
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 100, 100, 0, 0))
    environment = dict(os.environ, TERM="xterm-256color", PYTHONUTF8="1")
    environment.pop("NO_COLOR", None)
    environment.pop("FORCE_COLOR", None)
    process = subprocess.Popen([sys.executable, str(FOLDER / script), mode],
                               stdout=subprocess.PIPE if pipe_stdout else slave,
                               stderr=slave, env=environment, cwd=FOLDER)
    os.close(slave)
    output = bytearray()
    try:
        while True:
            ready, _, _ = select.select([master], [], [], 15)
            if not ready:
                raise TimeoutError("Terminal subprocess stopped producing output")
            try:
                chunk = os.read(master, 65536)
            except OSError as error:
                if error.errno == errno.EIO:
                    break
                raise
            if not chunk:
                break
            output.extend(chunk)
        stdout, _ = process.communicate(timeout=5)
        if process.returncode:
            raise AssertionError(output.decode("utf-8", errors="replace"))
    finally:
        os.close(master)
        if process.poll() is None:
            process.kill()
            process.wait()
    screen = pyte.Screen(100, 100)
    pyte.Stream(screen).feed(output.decode("utf-8"))
    rows = [row.rstrip() for row in screen.display if row.strip()]
    return rows, bytes(output), stdout


@unittest.skipUnless(os.name == "posix", "These tests require a Unix PTY")
class TerminalTests(unittest.TestCase):
    def test_imported_handlers_thread_logs_repeat_and_exception(self):
        rows, transcript, _ = run_terminal()
        for run in range(1, 3):
            bar = next(row for row in rows if row.startswith(f"Run-{run} 100% "))
            self.assertEqual(sum(f"Run-{run} " in row for row in rows), 1, rows)
            bar_index = rows.index(bar)
            for step in range(5):
                for prefix in ("ROOT", "OUT", "ERR"):
                    message = f"{prefix} run-{run}:step-{step} [bold]literal[/bold]"
                    self.assertEqual(rows.count(message), 1, rows)
                    self.assertLess(rows.index(message), bar_index)
            for prefix in ("ROOT", "OUT", "ERR"):
                self.assertEqual(rows.count(f"{prefix} after-run-{run}"), 1)
                self.assertGreater(rows.index(f"{prefix} after-run-{run}"), bar_index)
        self.assertEqual(rows.count("ROOT before-exception"), 1)
        for prefix in ("ROOT", "OUT", "ERR"):
            self.assertEqual(rows.count(f"{prefix} after-exception"), 1)
        self.assertIn("COMPLETE: two tasks reached 100%; streams restored", rows)
        logging_output = transcript.decode("utf-8").split("FILTER OBSERVATIONS ", 1)[0]
        self.assertNotIn("filtered-out", logging_output)
        self.assertNotIn("below-level", logging_output)
        marker = next(line for line in transcript.decode("utf-8").splitlines()
                      if line.startswith("FILTER OBSERVATIONS "))
        observations = json.loads(marker.removeprefix("FILTER OBSERVATIONS "))
        rejected = [message for message, accepted in observations if not accepted]
        allowed = [message for message, accepted in observations if accepted]
        self.assertEqual(rejected, ["filtered-out"] * 13)
        self.assertEqual(len(allowed), 13)
        for run in (1, 2):
            for step in range(5):
                self.assertIn(f"run-{run}:step-{step} [bold]literal[/bold]", allowed)
            self.assertIn(f"after-run-{run}", allowed)
        self.assertIn("after-exception", allowed)
        # Parse screen states at completed percentage writes, rather than
        # counting ANSI redraws as visible duplicate rows.
        screen = pyte.Screen(100, 100)
        parser = pyte.Stream(screen)
        visible_percentages = {1: set(), 2: set()}
        snapshots = 0
        for character in transcript.decode("utf-8"):
            parser.feed(character)
            if character != "%":
                continue
            snapshots += 1
            state = "\n".join(screen.display)
            for run in (1, 2):
                matches = re.findall(rf"Run-{run} +([0-9]+)%", state)
                self.assertLessEqual(len(matches), 1, state)
                visible_percentages[run].update(map(int, matches))
        self.assertGreater(snapshots, 0)
        for run in (1, 2):
            self.assertEqual(visible_percentages[run], {0, 20, 40, 60, 80, 100})

    def test_stdout_pipe_keeps_exact_records_with_stderr_progress(self):
        for mode in ("pipe", "pipe-default"):
            with self.subTest(mode=mode):
                rows, _, stdout = run_terminal(mode=mode, pipe_stdout=True)
                self.assertEqual(stdout, b'{"item": 0}\n{"item": 1}\n')
                self.assertEqual([json.loads(row) for row in stdout.splitlines()],
                                 [{"item": 0}, {"item": 1}])
                self.assertEqual(sum(row.startswith("Work 100% ") for row in rows), 1)
                for step in range(2):
                    self.assertEqual(rows.count(f"ERR pipe-step-{step}"), 1)
                self.assertFalse(any('"item"' in row for row in rows))

    def test_runnable_example_displays_one_finished_bar(self):
        rows, _, _ = run_terminal(script="example.py")
        self.assertEqual(sum("Processing" in row for row in rows), 1, rows)
        self.assertTrue(any("Processing" in row and "100%" in row for row in rows))
        for step in range(5):
            for prefix in ("ROOT", "OUT", "ERR"):
                self.assertEqual(rows.count(f"{prefix} step-{step} [bold]literal[/bold]"), 1)
        self.assertIn("ROOT finished; original logging streams restored", rows)


if __name__ == "__main__":
    unittest.main()
