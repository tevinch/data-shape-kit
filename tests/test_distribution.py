from __future__ import annotations

import email
import re
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class DistributionTests(unittest.TestCase):
    def test_built_distribution_uses_tool_only_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            output_directory = Path(temporary_directory)
            subprocess.run(
                [sys.executable, "-m", "build", "--outdir", str(output_directory)],
                cwd=ROOT,
                check=True,
                capture_output=True,
                text=True,
            )

            wheels = list(output_directory.glob("*.whl"))
            source_distributions = list(output_directory.glob("*.tar.gz"))
            self.assertEqual(len(wheels), 1)
            self.assertEqual(len(source_distributions), 1)

            with zipfile.ZipFile(wheels[0]) as wheel:
                metadata_path = next(
                    name for name in wheel.namelist() if name.endswith(".dist-info/METADATA")
                )
                entry_points_path = next(
                    name
                    for name in wheel.namelist()
                    if name.endswith(".dist-info/entry_points.txt")
                )
                metadata = email.message_from_bytes(wheel.read(metadata_path))
                entry_points = wheel.read(entry_points_path).decode("utf-8")

            self.assertEqual(metadata["Name"], "data-shape-kit")
            self.assertEqual(metadata["Version"], "0.1.1")
            self.assertEqual(
                metadata["Summary"],
                "Local, deterministic CSV normalization and deduplication",
            )
            self.assertEqual(metadata["Author"], "Tevinch")
            self.assertIsNone(metadata["Author-email"])
            self.assertEqual(metadata["Requires-Python"], ">=3.11")
            self.assertEqual(metadata.get_all("Requires-Dist"), None)
            self.assertEqual(
                entry_points.strip(),
                "[console_scripts]\ndata-shape-kit = data_shape_kit.cli:main",
            )

            description = metadata.get_payload()
            self.assertIn("Processing is local", description)
            self.assertIn("data-shape-kit input.csv cleaned.csv", description)
            self.assertNotIn("fixed-price", description.lower())
            self.assertNotIn("usd 25", description.lower())
            self.assertIsNone(re.search(r"[\w.+-]+@[\w.-]+\.[a-z]{2,}", description, re.I))
            self.assertIsNone(re.search(r"\b0x[a-f0-9]{40}\b", description, re.I))
            self.assertIsNone(re.search(r"\bbc1[a-z0-9]{25,62}\b", description, re.I))


if __name__ == "__main__":
    unittest.main()
