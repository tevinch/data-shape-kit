"""Run complete CSL JSON -> preparation -> Pandoc HTML checks."""

import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import subprocess
import sys
import tempfile

HERE = Path(__file__).resolve().parent


class References(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.entries = {}
        self.citations = []
        self.targets = []
        self.depth = 0
        self.feed(html)

    def handle_starttag(self, tag, attributes):
        self.depth += 1
        attributes = dict(attributes)
        if "csl-entry" in attributes.get("class", "").split():
            text = []
            self.entries[attributes["id"]] = text
            self.targets.append((self.depth, text))
        if "citation" in attributes.get("class", "").split():
            text = []
            self.citations.append(text)
            self.targets.append((self.depth, text))

    def handle_endtag(self, tag):
        self.targets = [(depth, text) for depth, text in self.targets if depth != self.depth]
        self.depth -= 1

    def handle_data(self, data):
        for _, text in self.targets:
            text.append(data)


def normalized(parts):
    return " ".join("".join(parts).split())


def run(*command):
    result = subprocess.run(command, capture_output=True, text=True, check=True)
    if result.stderr.strip():
        raise AssertionError(result.stderr)
    return result.stdout


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pandoc", default="pandoc", help="Pandoc executable (tested with 3.12)")
    args = parser.parse_args()
    print(run(args.pandoc, "--version").splitlines()[0])
    with tempfile.TemporaryDirectory() as directory:
        directory = Path(directory)
        source, prepared = directory / "library.json", directory / "library.pandoc.json"
        source.write_bytes((HERE / "example.json").read_bytes())

        def render(bibliography, document=HERE / "example.md", *extra):
            return References(run(args.pandoc, "--citeproc", "--bibliography", str(bibliography),
                                  str(document), "-t", "html5", *extra))

        before = render(source)
        assert normalized(before.entries["ref-gaulle"]).startswith("Gaulle, Charles de.")
        assert normalized(before.entries["ref-bitek"]).startswith("Bitek, Okot p’.")
        expected = {
            "ref-gaulle": "de Gaulle, Charles.",
            "ref-gogh": "Gogh, Vincent van.",
            "ref-hakim": "Hakim, Tawfiq al-.",
            "ref-humboldt": "Humboldt, Alexander von.",
            "ref-fontaine": "La Fontaine, Jean de.",
            "ref-bitek": "p’Bitek, Okot.",
        }
        for cycle in range(2):
            # A fresh export replaces the source between runs, just as an
            # export-on-change setup would. The derived file is regenerated.
            if cycle:
                data = json.loads(source.read_text())
                data[3]["title"] = "New export content"
                source.write_text(json.dumps(data), encoding="utf-8")
            original = source.read_bytes()
            run(sys.executable, str(HERE / "family_names.py"), str(source), str(prepared))
            assert source.read_bytes() == original
            after = render(prepared)
            assert list(after.entries) == list(expected), list(after.entries)
            for key, prefix in expected.items():
                assert normalized(after.entries[key]).startswith(prefix), (key, after.entries[key])
            assert len(after.citations) == 6
            assert [normalized(text) for text in after.citations] == [
                "van Gogh (n.d.)", "Humboldt (n.d.)", "al-Hakim (n.d.)",
                "de Gaulle (n.d.)", "La Fontaine (n.d.)", "p’Bitek (n.d.)",
            ]
            if cycle:
                assert "New Export Content" in normalized(after.entries["ref-gaulle"])

        # A small style makes editor/translator output and explicit particles
        # observable, rather than only testing the intermediate JSON.
        style = directory / "names.csl"
        style.write_text('''<style xmlns="http://purl.org/net/xbiblio/csl" version="1.0" class="in-text" demote-non-dropping-particle="never">
<info><title>Name check</title><id>urn:example:family-names</id><updated>2026-10-03T00:00:00+00:00</updated></info>
<macro name="names"><names variable="author editor translator"><name name-as-sort-order="all" initialize="false"/></names></macro>
<citation><layout><text macro="names"/></layout></citation>
<bibliography><sort><key macro="names"/></sort><layout><text macro="names"/></layout></bibliography>
</style>''', encoding="utf-8")
        data = json.loads((HERE / "example.json").read_text()) + [
            {"id": "editor", "type": "book", "editor": [{"given": "Ana", "family": "de Souza"}]},
            {"id": "translator", "type": "book", "translator": [{"given": "A", "family": "d’Arc"}]},
            {"id": "literal", "type": "book", "author": [{"literal": "Example Institute"}]},
            {"id": "suffix", "type": "book", "author": [{"family": "Smith", "given": "John", "suffix": "III", "comma-suffix": True}]},
        ]
        source.write_text(json.dumps(data), encoding="utf-8")
        document = directory / "all.md"
        document.write_text("\n\n".join("@" + item["id"] for item in data))
        run(sys.executable, str(HERE / "family_names.py"), str(source), str(prepared))
        after = render(prepared, document, "--csl", str(style))
        assert len(after.entries) == len(after.citations) == len(data)
        for key, value in {"gogh": "van Gogh, Vincent", "hakim": "al-Hakim, Tawfiq",
                           "editor": "de Souza, Ana", "translator": "d’Arc, A",
                           "literal": "Example Institute", "suffix": "Smith, John, III"}.items():
            assert normalized(after.entries["ref-" + key]) == value, (key, after.entries["ref-" + key])
        print("Verified two exports, 12 citations and bibliography entries, plus 10 names with a second style.")


if __name__ == "__main__":
    main()
