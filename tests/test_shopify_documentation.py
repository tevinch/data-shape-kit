import unittest
from pathlib import Path


class ShopifyDocumentationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(__file__).resolve().parents[1]

    def test_public_readmes_document_local_preflight_contract(self) -> None:
        for filename in ("README.md", "PYPI_README.md"):
            with self.subTest(filename=filename):
                text = (self.root / filename).read_text(encoding="utf-8")
                self.assertIn(
                    "data-shape-kit --shopify-preflight products.csv preflight.md",
                    text,
                )
                self.assertIn("does not include source cell values", text)
                self.assertIn("does not guarantee import acceptance", text)
                self.assertIn("URL handle", text)
                self.assertIn("Option1", text)

    def test_readme_links_to_current_official_shopify_guidance(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")

        self.assertIn(
            "https://help.shopify.com/en/manual/products/import-export/using-csv",
            readme,
        )
        self.assertIn(
            "https://help.shopify.com/en/manual/products/import-export/import-products",
            readme,
        )

    def test_github_install_command_is_pinned_to_new_version(self) -> None:
        readme = (self.root / "README.md").read_text(encoding="utf-8")
        command = (
            'python -m pip install "data-shape-kit @ '
            'https://github.com/tevinch/data-shape-kit/archive/refs/tags/v0.5.0.tar.gz"'
        )

        self.assertIn(command, readme)
        self.assertNotIn("archive/refs/tags/v0.4.0.tar.gz", readme)


if __name__ == "__main__":
    unittest.main()
