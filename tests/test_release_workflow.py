from __future__ import annotations

import json
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "release.yml"


def load_workflow() -> dict[str, object]:
    completed = subprocess.run(
        [
            "ruby",
            "-e",
            (
                'require "yaml"; require "json"; '
                "print JSON.generate(YAML.safe_load(File.read(ARGV[0]), aliases: true))"
            ),
            str(WORKFLOW),
        ],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(completed.stdout)


class ReleaseWorkflowTests(unittest.TestCase):
    def test_release_workflow_builds_before_oidc_publish(self) -> None:
        self.assertTrue(WORKFLOW.exists(), "release workflow must exist")
        workflow = load_workflow()
        triggers = workflow.get("on", workflow.get("true"))
        self.assertEqual(
            triggers,
            {
                "release": {"types": ["published"]},
                "workflow_dispatch": {},
            },
        )
        self.assertEqual(workflow["permissions"], {"contents": "read"})

        jobs = workflow["jobs"]
        self.assertEqual(set(jobs), {"build", "publish"})
        build = jobs["build"]
        publish = jobs["publish"]
        self.assertNotIn("id-token", build.get("permissions", {}))
        self.assertEqual(publish["needs"], "build")
        self.assertEqual(publish["environment"], {"name": "pypi"})
        self.assertEqual(
            publish["permissions"],
            {"contents": "read", "id-token": "write"},
        )

        build_text = json.dumps(build, sort_keys=True)
        self.assertIn('"python-version": "3.12"', build_text)
        self.assertIn("python -m unittest discover -s tests -v", build_text)
        self.assertIn("python -m build", build_text)
        self.assertIn("python -m twine check dist/*", build_text)
        self.assertIn("actions/upload-artifact", build_text)

        publish_text = json.dumps(publish, sort_keys=True)
        self.assertIn("actions/download-artifact", publish_text)
        self.assertIn("pypa/gh-action-pypi-publish", publish_text)
        self.assertNotIn("password", publish_text.lower())
        self.assertNotIn("api-token", publish_text.lower())
        self.assertNotIn("secrets.", publish_text.lower())


if __name__ == "__main__":
    unittest.main()
