"""Prepare PDF.js 6.3.289 with a separate XFA rich-text worker.

Python 3.10+; standard library only. Apache-2.0 (see LICENSE).
Reproduces the missing-method issue reported by vsmeenaravi in PDF.js #22023.
"""
from pathlib import Path, PurePosixPath
import base64
import hashlib
import io
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parent
VERSION = "6.3.289"
URL = f"https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-{VERSION}.tgz"
INTEGRITY = "ZHjSVpDa3D6izMq8/04lvkhkATUmL9px6ChPaXc1k6nU2Mrhlg1/7F0bdUqCwUjw3NsPTfPZsMDUU6ZIcRaeQw=="
WORKERS = {
    "build/pdf.worker.mjs": "f2870db902eaff8397442c912b69459980ac91f6f4b5ed827167b12cf7057930",
    "legacy/build/pdf.worker.mjs": "df3bf6bf6b8b8dac8a4042d8c4ecf1cf21e1d197e0fe231c192122409eba656b",
}
def patch_worker(original: str) -> str:
    # Route semantic tags through the existing common style/measurement path.
    # Explicit document styles come last and can override the defaults.
    for tag, cls, key, value, css in [
        ("b", "B", "weight", "bold", "font-weight:bold;"),
        ("i", "I", "posture", "italic", "font-style:italic;"),
    ]:
        old = f'''class {cls} extends XhtmlObject {{
  constructor(attributes) {{
    super(attributes, "{tag}");
  }}
  [$pushGlyphs](measure) {{
    measure.pushFont({{
      {key}: "{value}"
    }});
    super[$pushGlyphs](measure);
    measure.popFont();
  }}
}}'''
        new = f'''class {cls} extends XhtmlObject {{
  constructor(attributes) {{
    super(attributes, "{tag}");
    this.style = `{css}${{this.style}}`;
  }}
}}'''
        if original.count(old) != 1:
            raise ValueError("Unexpected source; use the unmodified 6.3.289 worker")
        original = original.replace(old, new)
    return original


def prepare(root: Path = ROOT) -> None:
    with urllib.request.urlopen(URL, timeout=60) as response:
        archive = response.read()
    actual = base64.b64encode(hashlib.sha512(archive).digest()).decode("ascii")
    if actual != INTEGRITY:
        raise ValueError("Package integrity mismatch; nothing extracted")
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as package:
        for member in package.getmembers():
            parts = PurePosixPath(member.name).parts
            if not member.isfile() or len(parts) < 2 or parts[0] != "package":
                continue
            relative = PurePosixPath(*parts[1:])
            if relative.is_absolute() or ".." in relative.parts:
                raise ValueError("Invalid package path")
            if relative.parts[0] not in {"build", "legacy", "web", "standard_fonts", "cmaps", "wasm"} and str(relative) not in {"LICENSE", "package.json"}:
                continue
            if relative.suffix == ".map":
                continue
            target = root / "runtime" / relative
            if not target.resolve().is_relative_to(root.resolve()):
                raise ValueError("Runtime output path leaves the example directory")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(package.extractfile(member).read())
    for relative, expected in WORKERS.items():
        source = root / "runtime" / relative
        if hashlib.sha256(source.read_bytes()).hexdigest() != expected:
            raise ValueError("Worker integrity mismatch; no repair written")
        source.with_name("pdf.worker.xfa.mjs").write_bytes(
            patch_worker(source.read_bytes().decode("utf-8")).encode("utf-8")
        )
    print("Ready: original 6.3.289 workers retained; separate pdf.worker.xfa.mjs copies prepared.")
    print("Run: python3 -m http.server 8000 --bind 127.0.0.1")


if __name__ == "__main__":
    prepare()
