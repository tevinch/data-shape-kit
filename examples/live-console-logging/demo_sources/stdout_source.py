"""A module that configures its stdout handler before progress starts."""

import logging
import sys

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
logger.propagate = False
handler = logging.StreamHandler(sys.stdout)
handler.setLevel(logging.INFO)
handler.setFormatter(logging.Formatter("OUT %(message)s"))
handler.addFilter(lambda record: getattr(record, "include", True))
logger.addHandler(handler)


def report(message: str) -> None:
    logger.debug("below-level")
    logger.info("filtered-out", extra={"include": False})
    logger.info(message)
