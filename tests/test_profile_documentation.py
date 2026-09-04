import unittest
from pathlib import Path


class ProfileDocumentationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(__file__).resolve().parents[1]

    def test_public_readmes_document_profile_privacy_contract(self) -> None:
        for filename in ("README.md", "PYPI_README.md"):
            with self.subTest(filename=filename):
                text = (self.root / filename).read_text(encoding="utf-8")
                self.assertIn("data-shape-kit --profile input.csv profile.json", text)
                self.assertIn("does not include source cell values", text)
                self.assertIn("empty values", text)
                self.assertIn("distinct non-empty values", text)


if __name__ == "__main__":
    unittest.main()
