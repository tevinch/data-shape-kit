"""Run with: python -m unittest -v"""

from contextlib import contextmanager
import io
import logging
import os
import pty
import select
import sys
import tempfile
import unittest

from rich.console import Console
from rich.logging import RichHandler
from rich.progress import Progress

from live_log_streams import live_log_streams


@contextmanager
def terminal_streams():
    master, slave = pty.openpty()
    stdout = os.fdopen(os.dup(slave), "w", buffering=1)
    stderr = os.fdopen(os.dup(slave), "w", buffering=1)
    previous = sys.stdout, sys.stderr
    sys.stdout, sys.stderr = stdout, stderr
    try:
        yield stdout, stderr
    finally:
        sys.stdout, sys.stderr = previous
        stdout.close()
        stderr.close()
        os.close(slave)
        os.close(master)


@unittest.skipUnless(os.name == "posix", "These tests require a Unix PTY")
class ConsoleStreamsTests(unittest.TestCase):
    def setUp(self):
        root = logging.getLogger()
        self.root_state = root.handlers[:], root.level
        root.handlers.clear()
        root.setLevel(logging.INFO)
        self.loggers = []

    def tearDown(self):
        for logger in self.loggers:
            for handler in logger.handlers[:]:
                logger.removeHandler(handler)
                handler.close()
        root = logging.getLogger()
        for handler in root.handlers[:]:
            root.removeHandler(handler)
            handler.close()
        root.handlers[:] = self.root_state[0]
        root.setLevel(self.root_state[1])

    def logger(self, name):
        logger = logging.getLogger("console_test." + name)
        logger.setLevel(logging.INFO)
        logger.propagate = False
        self.loggers.append(logger)
        return logger

    def handler(self, logger, stream):
        handler = logging.StreamHandler(stream)
        logger.addHandler(handler)
        return handler

    def progress(self, **settings):
        return Progress(console=Console(stderr=True, color_system=None),
                        auto_refresh=False, **settings)

    def test_registered_root_and_dotted_named_handlers_follow_live_streams(self):
        # Removing named-logger traversal would leave these two stale streams.
        with terminal_streams() as (stdout, stderr):
            root = self.handler(logging.getLogger(), stderr)
            output = self.handler(self.logger("missing_parent.output"), stdout)
            errors = self.handler(self.logger("errors"), stderr)
            with self.progress():
                with live_log_streams():
                    self.assertIs(root.stream, sys.stderr)
                    self.assertIs(output.stream, sys.stdout)
                    self.assertIs(errors.stream, sys.stderr)
            self.assertIs(root.stream, stderr)
            self.assertIs(output.stream, stdout)
            self.assertIs(errors.stream, stderr)

    def test_exception_restores_each_exact_stream_on_repeated_runs(self):
        with terminal_streams() as (stdout, stderr):
            output = self.handler(self.logger("repeat.output"), stdout)
            errors = self.handler(self.logger("repeat.errors"), stderr)
            for _ in range(2):
                with self.assertRaisesRegex(RuntimeError, "stopped"):
                    with self.progress():
                        with live_log_streams():
                            self.assertIs(output.stream, sys.stdout)
                            self.assertIs(errors.stream, sys.stderr)
                            raise RuntimeError("stopped")
                self.assertIs(output.stream, stdout)
                self.assertIs(errors.stream, stderr)

    def test_shared_handler_and_nested_scopes_keep_outer_binding(self):
        with terminal_streams() as (_, stderr):
            shared = self.handler(self.logger("shared.one"), stderr)
            self.logger("shared.two").addHandler(shared)
            with self.progress():
                with live_log_streams() as refresh:
                    self.assertIs(shared.stream, sys.stderr)
                    self.assertEqual(refresh(), 0)
                    with live_log_streams():
                        self.assertIs(shared.stream, sys.stderr)
                    self.assertIs(shared.stream, sys.stderr)
            self.assertIs(shared.stream, stderr)

    def test_refresh_discovers_new_handlers_before_they_emit(self):
        with terminal_streams() as (_, stderr):
            with self.progress():
                with live_log_streams() as refresh:
                    late = self.handler(self.logger("late"), stderr)
                    self.assertEqual(refresh(), 1)
                    self.assertIs(late.stream, sys.stderr)
            self.assertIs(late.stream, stderr)

    def test_exit_keeps_an_intentional_stream_change(self):
        with terminal_streams() as (_, stderr):
            handler = self.handler(self.logger("changed"), stderr)
            destination = io.StringIO()
            with self.progress():
                with live_log_streams() as refresh:
                    self.assertIs(handler.stream, sys.stderr)
                    handler.setStream(destination)
                    self.assertEqual(refresh(), 0)
                    logging.getLogger("console_test.changed").info("new destination")
            self.assertIs(handler.stream, destination)
            self.assertEqual(destination.getvalue(), "new destination\n")

    def test_disabled_redirection_is_respected_per_stream(self):
        for disabled in ("stdout", "stderr"):
            with self.subTest(disabled=disabled), terminal_streams() as (stdout, stderr):
                output = self.handler(self.logger("disabled." + disabled), stdout)
                errors = self.handler(self.logger("enabled." + disabled), stderr)
                with self.progress(**{"redirect_" + disabled: False}):
                    with live_log_streams():
                        self.assertIs(output.stream, stdout if disabled == "stdout" else sys.stdout)
                        self.assertIs(errors.stream, stderr if disabled == "stderr" else sys.stderr)

    def test_non_newline_terminator_handler_is_not_rebound(self):
        # Rich's buffered flush would interpret literal markup and add a newline.
        with terminal_streams() as (_, stderr):
            handler = self.handler(self.logger("custom_terminator"), stderr)
            handler.terminator = ""
            with self.progress():
                with live_log_streams():
                    self.assertIs(handler.stream, stderr)
                    logging.getLogger("console_test.custom_terminator").info("[bold]literal[/bold]")
            self.assertEqual(handler.terminator, "")

    def test_aliased_streams_keep_disabled_channel_intent(self):
        # One object cannot identify which channel a handler originally chose.
        for disabled in ("stdout", "stderr"):
            with self.subTest(disabled=disabled), terminal_streams() as (_, terminal):
                sys.stdout = sys.stderr = terminal
                output = self.handler(self.logger("alias.output." + disabled), sys.stdout)
                errors = self.handler(self.logger("alias.errors." + disabled), sys.stderr)
                with self.progress(**{"redirect_" + disabled: False}):
                    with live_log_streams():
                        self.assertIs(output.stream, terminal)
                        self.assertIs(errors.stream, terminal)

    def test_file_custom_stream_and_custom_handler_are_unchanged(self):
        class CustomHandler(logging.StreamHandler):
            pass

        with terminal_streams() as (_, stderr), tempfile.TemporaryDirectory() as directory:
            logger = self.logger("destinations")
            file_handler = logging.FileHandler(os.path.join(directory, "messages.log"))
            destination = io.StringIO()
            custom_stream = self.handler(logger, destination)
            read_fd, write_fd = os.pipe()
            pipe_writer = os.fdopen(write_fd, "w", buffering=1)
            self.addCleanup(os.close, read_fd)
            pipe_handler = self.handler(logger, pipe_writer)
            self.addCleanup(pipe_writer.close)
            custom_handler = CustomHandler(stderr)
            rich_handler = RichHandler(console=Console(stderr=True))
            logger.addHandler(file_handler)
            logger.addHandler(custom_handler)
            logger.addHandler(rich_handler)
            file_stream = file_handler.stream
            with self.progress():
                with live_log_streams():
                    self.assertIs(file_handler.stream, file_stream)
                    self.assertIs(custom_stream.stream, destination)
                    self.assertIs(pipe_handler.stream, pipe_writer)
                    self.assertIs(custom_handler.stream, stderr)
                    logger.info("destination still works")
            file_handler.flush()
            with open(file_handler.baseFilename) as source:
                self.assertEqual(source.read(), "destination still works\n")
            self.assertEqual(destination.getvalue(), "destination still works\n")
            self.assertTrue(select.select([read_fd], [], [], 1)[0])
            self.assertEqual(os.read(read_fd, 1024), b"destination still works\n")

    def test_partial_entry_failure_restores_previously_bound_handler(self):
        class FlushFailure:
            def __init__(self, terminal):
                self.terminal = terminal
                self.fail = False

            def isatty(self):
                return self.terminal.isatty()

            def write(self, text):
                return self.terminal.write(text)

            def flush(self):
                if self.fail:
                    self.fail = False
                    raise OSError("flush failed")
                self.terminal.flush()

        with terminal_streams() as (stdout, stderr):
            broken = FlushFailure(stderr)
            sys.stderr = broken
            first = self.handler(logging.getLogger(), stdout)
            second = self.handler(logging.getLogger(), broken)
            with self.progress():
                broken.fail = True
                with self.assertRaisesRegex(OSError, "flush failed"):
                    with live_log_streams():
                        self.fail("entry must fail")
                self.assertIs(first.stream, stdout)
                self.assertIs(second.stream, broken)

    def test_restore_failure_does_not_strand_other_handlers(self):
        class WriteFailure(io.StringIO):
            fail = False

            def isatty(self):
                return True

            def write(self, text):
                if self.fail:
                    self.fail = False
                    raise OSError("write failed")
                return super().write(text)

        with terminal_streams() as (stdout, stderr):
            destination = WriteFailure()
            first = self.handler(logging.getLogger(), stdout)
            second = self.handler(logging.getLogger(), stderr)
            progress = Progress(console=Console(file=destination, color_system=None),
                                auto_refresh=False)
            with progress:
                with self.assertRaises(Exception) as raised:
                    with live_log_streams():
                        sys.stderr.write("unfinished line")
                        destination.fail = True
                        raise ValueError("original failure")
                self.assertIs(first.stream, stdout)
                self.assertIs(second.stream, sys.stderr)
                self.assertIsInstance(raised.exception, ExceptionGroup)
                self.assertIsInstance(raised.exception.__context__, ValueError)
                self.assertRegex(str(raised.exception.exceptions[0]), "write failed")


if __name__ == "__main__":
    unittest.main()
