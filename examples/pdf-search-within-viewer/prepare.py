"""Fetch the official PDF.js 6.3.289 runtime and make a separate scoped copy.

Python 3.10+; standard library only. Original runtime files are retained.
License: Apache-2.0 (see LICENSE).
"""
from pathlib import Path, PurePosixPath
import base64
import hashlib
import io
import tarfile
import urllib.request

VERSION = "6.3.289"
URL = f"https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-{VERSION}.tgz"
INTEGRITY = "ZHjSVpDa3D6izMq8/04lvkhkATUmL9px6ChPaXc1k6nU2Mrhlg1/7F0bdUqCwUjw3NsPTfPZsMDUU6ZIcRaeQw=="
MODULE_HASH = "e48aa528d626b49b70705245c22646cf41b59c54f77243d8612dcffdc366b823"
ROOT = Path(__file__).resolve().parent


def patched_module(original: str, helper: str) -> str:
    replacements = [
        ('element.scrollIntoView({\n      block: "start",\n      inline: "center"\n    });',
         'scrollSearchMatch(element, this._linkService.pdfViewer.container);'),
        ('function scrollIntoView(element, spot) {',
         'function scrollIntoView(element, spot, scrollContainer = null) {'),
        ('while (parent.clientHeight === parent.scrollHeight && parent.clientWidth === parent.scrollWidth) {',
         'while (parent !== scrollContainer && parent.clientHeight === parent.scrollHeight && parent.clientWidth === parent.scrollWidth) {'),
        ('scrollIntoView(div, pageSpot);',
         'scrollIntoView(div, pageSpot, this.container);'),
    ]
    for old, new in replacements:
        if original.count(old) != 1:
            raise ValueError("Unexpected PDF.js source; do not patch a different release")
        original = original.replace(old, new)
    return original + "\n" + helper


def main() -> None:
    with urllib.request.urlopen(URL, timeout=60) as response:
        archive = response.read()
    actual = base64.b64encode(hashlib.sha512(archive).digest()).decode("ascii")
    if actual != INTEGRITY:
        raise ValueError("Official package integrity mismatch; nothing extracted")
    runtime = ROOT / "runtime"
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as package:
        for member in package.getmembers():
            parts = PurePosixPath(member.name).parts
            if not member.isfile() or len(parts) < 2 or parts[0] != "package":
                continue
            relative = PurePosixPath(*parts[1:])
            if relative.is_absolute() or ".." in relative.parts:
                raise ValueError("Invalid package path")
            allowed = relative.parts[0] in {"build", "web", "standard_fonts", "cmaps", "wasm"}
            if not allowed and str(relative) not in {"LICENSE", "package.json"}:
                continue
            if relative.suffix == ".map":
                continue
            target = runtime.joinpath(*relative.parts)
            # Do not follow a pre-existing output symlink outside this example.
            if not target.resolve().is_relative_to(ROOT.resolve()):
                raise ValueError("Runtime output path leaves the example directory")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(package.extractfile(member).read())
    module = runtime / "web/pdf_viewer.mjs"
    if hashlib.sha256(module.read_bytes()).hexdigest() != MODULE_HASH:
        raise ValueError("Unexpected viewer module; no patched module written")
    helper = (ROOT / "scroll-search-match.js").read_text()
    result = patched_module(module.read_text(), helper)
    module.with_name("pdf_viewer.scoped.mjs").write_text(result)
    print(f"Ready: official PDF.js {VERSION} plus a separate scoped viewer module.")
    print("Run: python3 -m http.server 8000 --bind 127.0.0.1")
    print("Then open http://127.0.0.1:8000/ in your browser.")


if __name__ == "__main__":
    main()
