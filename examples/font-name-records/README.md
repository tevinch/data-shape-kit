# Select a font name record explicitly

For the pinned Sniglet font in [FontTools issue #4322](https://github.com/fonttools/fonttools/issues/4322), you can keep the previous description text on FontTools 4.67.0 by selecting its Macintosh Roman English record directly:

```python
from fontTools.ttLib import TTFont

with TTFont("Sniglet-Regular.ttf") as font:
    record = font["name"].getName(10, 1, 0, 0)
    description = record.toUnicode() if record is not None else None
    print(repr(description))
```

The arguments are `nameID=10` (description), `platformID=1` (Macintosh), `platEncID=0` (Roman), and `langID=0` (English). They select a record inside the font; they do not depend on the operating system running Python. [`getName` and `toUnicode`](https://fonttools.readthedocs.io/en/latest/ttLib/tables/_n_a_m_e.html) are existing public APIs.

For this file, the selected text contains `that’s` (U+2019) and matches the **complete** 4.66.1 `getDebugName(10)` result, including its carriage returns. The 4.67.0 default selects the Windows English record, which contains `thatÕs` (U+00D5). [PR #4273](https://github.com/fonttools/fonttools/pull/4273) intentionally changed that preference. This example leaves it intact and does not modify the font.

Use explicit selection only when that record is the one your application intends to read. Other fonts can have different or missing records; this snippet returns `None` when the requested tuple is absent. It is not a general encoding repair, a universal replacement for `getDebugName`, or a way to recover missing text. Replacing every `Õ` with an apostrophe would also alter legitimate text.

## Reproduce the comparison

Use Python 3.11 or newer. Open a terminal in this directory:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install --only-binary=:all: -r requirements.txt
curl -fL https://raw.githubusercontent.com/google/fonts/b669b896a75927719f611ac76f329bbeab32dc61/ofl/sniglet/Sniglet-Regular.ttf -o Sniglet-Regular.ttf
.venv/bin/python check.py Sniglet-Regular.ttf
```

`check.py` first verifies that the input is the exact 75,212-byte source file from the report, with SHA-256 `2856a975b9c0ac0402e8402ac4bd126cd97d6c90490435b6198d77e6384ae4f0`. It checks the entire selected description against the old result's UTF-8 hash, reopens the file three times, verifies that the Windows default remains unchanged, and checks that the original font bytes stay identical. A successful run prints `description_matches_4_66_1: true` in its JSON output.

To see the original mismatch on the same current release, run this negative control. It is expected to exit with an assertion failure:

```sh
.venv/bin/python check.py Sniglet-Regular.ttf --baseline
```

The original 4.66.1 default and 4.67.0 explicit record were also compared as complete Unicode strings in separate Python environments. These are scripted checks on Python 3.12/macOS, not confirmation from the original reporter or a claim that FontTools changed. The code and guide use the repository's [MIT license](../../LICENSE). The downloaded font retains its [SIL Open Font License](https://github.com/google/fonts/blob/b669b896a75927719f611ac76f329bbeab32dc61/ofl/sniglet/OFL.txt); it is not bundled here.

## Optional coffee

This example and guide are free. If they saved you time and you would like to buy me a coffee, a small contribution is entirely optional:

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
