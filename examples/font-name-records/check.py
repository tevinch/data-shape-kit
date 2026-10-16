"""Check explicit name-record selection against the pinned Sniglet font."""

import argparse
import hashlib
import json
from pathlib import Path

import fontTools
from fontTools.ttLib import TTFont


FONT_SHA256 = "2856a975b9c0ac0402e8402ac4bd126cd97d6c90490435b6198d77e6384ae4f0"
DESCRIPTION_SHA256 = "60479a6a8cfea2a0c532c9746beb24103d5aaa400aa7561da208260eba3dcb5d"

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("font", type=Path)
parser.add_argument("--baseline", action="store_true", help="Use getDebugName; fails on 4.67.0")
args = parser.parse_args()

before = hashlib.sha256(args.font.read_bytes()).hexdigest()
if before != FONT_SHA256:
    raise SystemExit("This check requires the exact Sniglet file linked in README.md.")
if fontTools.version != "4.67.0":
    raise SystemExit("Run this comparison with the pinned FontTools 4.67.0 dependency.")

for _ in range(3):
    with TTFont(args.font) as font:
        names = font["name"]
        record = names.getName(10, 1, 0, 0)
        description = record.toUnicode() if record is not None else None
        if args.baseline:
            description = names.getDebugName(10)
        assert description is not None, "The selected description record is missing."
        assert hashlib.sha256(description.encode("utf-8")).hexdigest() == DESCRIPTION_SHA256, (
            "The complete description differs from the 4.66.1 default result."
        )
        windows_record = names.getName(10, 3, 1, 0x409)
        assert windows_record is not None
        assert names.getDebugName(10) == windows_record.toUnicode()
        assert names.getDebugName(10) != description

assert hashlib.sha256(args.font.read_bytes()).hexdigest() == before
print(json.dumps({
    "fonttools": fontTools.version,
    "record": [10, 1, 0, 0],
    "description_matches_4_66_1": True,
    "description_sha256": DESCRIPTION_SHA256,
    "windows_default_unchanged": True,
    "repeated_reads": 3,
    "font_bytes_unchanged": True,
}, indent=2))
