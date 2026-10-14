"""A module that configures its stderr handler before progress starts."""

import logging
import sys

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
logger.propagate = False
handler = logging.StreamHandler(sys.stderr)
handler.setLevel(logging.WARNING)
handler.setFormatter(logging.Formatter("ERR %(message)s"))
logger.addHandler(handler)


def report(message: str) -> None:
    logger.info("below-level")
    logger.warning(message)
