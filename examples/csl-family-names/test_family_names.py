import copy
from decimal import Decimal
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from family_names import prepare_bibliography

SCRIPT = Path(__file__).with_name("family_names.py")


class FamilyNamesTest(unittest.TestCase):
    def test_preserves_structured_surnames_and_other_fields(self):
        source = [{"id": "item", "type": "book", "title": "A title", "author": [
            {"family": "de Gaulle", "given": "Charles"},
            {"family": "p’Bitek", "given": "Okot"},
            {"family": "Gogh", "given": "Vincent", "non-dropping-particle": "van"},
            {"family": "La Fontaine", "given": "Jean", "dropping-particle": "de"},
            {"family": "Humboldt", "given": "Alexander", "dropping-particle": "von"},
            {"family": "Hakim", "given": "Tawfiq", "non-dropping-particle": "al-"},
            {"family": "Smith", "given": "John", "suffix": "III", "comma-suffix": True},
            {"literal": "Example Institute"},
        ], "issued": {"date-parts": [[2026, 10, 3]]}, "custom": {"family": "untouched"}}]
        original = copy.deepcopy(source)
        expected = copy.deepcopy(source)
        for index in [0, 1, 3, 4, 6]:
            expected[0]["author"][index]["family"] = '"' + expected[0]["author"][index]["family"] + '"'
        self.assertEqual(prepare_bibliography(source), expected)
        self.assertEqual(source, original)
        self.assertEqual(prepare_bibliography(expected), expected)

    def test_editors_translators_unicode_and_explicit_empty_particle(self):
        source = [{"id": 123, "type": "book", "editor": [{"family": "de Souza", "given": "Ana"}],
                   "translator": [{"family": "王", "given": "明"}],
                   "author": [{"family": 'd’Arc "Test"', "given": "A"},
                              {"family": "de Test", "non-dropping-particle": ""},
                              {"family": '"de Quoted"'}, {"literal": "Institute", "family": "de Ignored"}]}]
        result = prepare_bibliography(source)
        self.assertEqual(result[0]["editor"][0]["family"], '\"de Souza\"')
        self.assertEqual(result[0]["translator"][0]["family"], '\"王\"')
        self.assertEqual(result[0]["author"][0]["family"], '\"d’Arc \"Test\"\"')
        self.assertEqual(result[0]["author"][1:], source[0]["author"][1:])

    def test_invalid_shape_is_rejected(self):
        for data in [{}, [None], [{"id": "x", "author": "de Gaulle"}],
                     [{"id": "x", "author": [None]}], [{"id": "x", "author": [{"family": 2}]}]]:
            with self.subTest(data=data), self.assertRaises(ValueError):
                prepare_bibliography(data)

    def test_command_keeps_exact_numeric_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            source, output = Path(directory) / "in.json", Path(directory) / "out.json"
            source.write_text('[{"id":"x","custom":0.12345678901234567890123456789,"big":1e400}]')
            result = self.run_command(source, output)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(output.read_text(), parse_float=Decimal),
                             json.loads(source.read_text(), parse_float=Decimal))

    def run_command(self, source, output):
        return subprocess.run([sys.executable, str(SCRIPT), str(source), str(output)],
                              capture_output=True, text=True)

    def test_command_repeated_export_preserves_source_and_refreshes_output(self):
        with tempfile.TemporaryDirectory() as directory:
            source, output = Path(directory) / "library.json", Path(directory) / "library.pandoc.json"
            for family in ["de Gaulle", "p’Bitek"]:
                data = ('[{"id":"book","author":[{"family":' + json.dumps(family) + '}],"custom":42}]').encode()
                source.write_bytes(data)
                result = self.run_command(source, output)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(source.read_bytes(), data)
                self.assertEqual(json.loads(output.read_text())[0]["author"][0]["family"], '"' + family + '"')

    def test_bad_json_and_same_file_never_damage_existing_content(self):
        with tempfile.TemporaryDirectory() as directory:
            source, output = Path(directory) / "library.json", Path(directory) / "prepared.json"
            data = b'[{"id":"book","author":[{"family":"de Gaulle"}]}]'
            source.write_bytes(data)
            for target in [source, output]:
                if target != source:
                    os.link(source, target)
                result = self.run_command(source, target)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(source.read_bytes(), data)
            output.unlink()
            output.symlink_to(source)
            self.assertNotEqual(self.run_command(source, output).returncode, 0)
            self.assertEqual(source.read_bytes(), data)
            output.unlink()
            output.write_text("previous output")
            for invalid in ['[', '[{"id":"a","id":"b"}]', '[{"custom":NaN}]']:
                source.write_text(invalid)
                self.assertNotEqual(self.run_command(source, output).returncode, 0)
                self.assertEqual(output.read_text(), "previous output")


if __name__ == "__main__":
    unittest.main()
