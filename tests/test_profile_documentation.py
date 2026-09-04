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

    def test_github_install_command_is_pinned_to_the_package_version(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")
        command = (
            'python -m pip install "data-shape-kit @ '
            'git+https://github.com/tevinch/data-shape-kit.git@v0.2.0"'
        )

        self.assertIn(command, readme)
        self.assertNotIn("data-shape-kit.git@main", readme)


if __name__ == "__main__":
    unittest.main()
