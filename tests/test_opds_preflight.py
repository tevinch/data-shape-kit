from __future__ import annotations

import importlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from data_shape_kit.clean import CsvShapeError


class OpdsPreflightTests(unittest.TestCase):
    @staticmethod
    def _module():
        return importlib.import_module("data_shape_kit.opds_preflight")

    @staticmethod
    def _safe_catalog() -> dict[str, object]:
        return {
            "metadata": {"title": "Private value: public classics"},
            "links": [
                {
                    "rel": "self",
                    "href": "https://catalog.example/opds",
                    "type": "application/opds+json",
                }
            ],
            "publications": [
                {
                    "metadata": {
                        "title": "Private value: one book",
                        "author": "Private value: one author",
                        "identifier": "urn:isbn:9780000000002",
                        "language": "en",
                    },
                    "links": [
                        {
                            "rel": "download",
                            "href": "https://catalog.example/books/one.epub",
                            "type": "application/epub+zip",
                        }
                    ],
                    "images": [
                        {
                            "href": "https://catalog.example/covers/one.jpg",
                            "type": "image/jpeg",
                        }
                    ],
                }
            ],
        }

    def _run_catalog(self, catalog: object):
        module = self._module()
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        directory = Path(temporary.name)
        source = directory / "catalog.json"
        target = directory / "report.md"
        source.write_text(json.dumps(catalog), encoding="utf-8")
        return module, module.preflight_opds(source, target), target

    def test_accepts_public_catalog_without_copying_values(self) -> None:
        module, report, target = self._run_catalog(self._safe_catalog())

        self.assertEqual(
            report,
            module.OpdsPreflightReport(
                input_rows=1,
                collection_count=1,
                catalog_type="OPDS 2.0",
                findings=(),
            ),
        )
        output = target.read_text(encoding="utf-8")
        self.assertIn("Catalog type: OPDS 2.0", output)
        self.assertIn("Collections: 1", output)
        self.assertIn("Publications: 1", output)
        self.assertIn("Findings: 0", output)
        for source_value in (
            "public classics",
            "one book",
            "one author",
            "9780000000002",
            "catalog.example",
        ):
            self.assertNotIn(source_value, output)

    def test_reports_invalid_json_and_root_without_source_values(self) -> None:
        module = self._module()
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            target = directory / "report.md"
            invalid = directory / "invalid.json"
            invalid.write_text('{"private-title": ', encoding="utf-8")

            invalid_report = module.preflight_opds(invalid, target)

            self.assertEqual(
                invalid_report.findings,
                (module.OpdsFinding("invalid_json_syntax", "error", 1, ()),),
            )
            self.assertNotIn("private-title", target.read_text(encoding="utf-8"))

            array_source = directory / "array.json"
            array_source.write_text('["private-root"]', encoding="utf-8")
            root_report = module.preflight_opds(array_source, target)
            self.assertEqual(
                root_report.findings,
                (module.OpdsFinding("invalid_root", "error", 1, ()),),
            )
            self.assertNotIn("private-root", target.read_text(encoding="utf-8"))

    def test_reports_missing_feed_core(self) -> None:
        module, report, _ = self._run_catalog(
            {"metadata": {}, "links": [], "publications": []}
        )

        self.assertEqual(
            report.findings,
            (
                module.OpdsFinding("missing_feed_title", "error", 1, ()),
                module.OpdsFinding("missing_feed_self_link", "error", 1, ()),
                module.OpdsFinding("missing_catalog_collection", "error", 1, ()),
            ),
        )

    def test_reports_collection_shape_and_titles(self) -> None:
        catalog = {
            "metadata": {"title": "Private feed"},
            "links": [{"rel": "self", "href": "/opds"}],
            "navigation": [{"href": "/new"}],
            "groups": [
                {
                    "metadata": {},
                    "navigation": [],
                    "publications": [],
                }
            ],
            "facets": [
                {
                    "metadata": {},
                    "links": [{"href": "/en", "title": "Private English"}],
                }
            ],
        }

        _, report, output_path = self._run_catalog(catalog)
        by_code = {finding.code: finding for finding in report.findings}

        self.assertEqual(
            by_code["missing_navigation_title"].locations,
            ("navigation.1",),
        )
        self.assertEqual(by_code["missing_group_title"].locations, ("group.1",))
        self.assertEqual(by_code["invalid_group_collections"].locations, ("group.1",))
        self.assertEqual(by_code["missing_facet_title"].locations, ("facet.1",))
        self.assertEqual(by_code["sparse_facet_links"].severity, "warning")
        self.assertNotIn("Private English", output_path.read_text(encoding="utf-8"))

    def test_reports_publication_requirements_and_image_support(self) -> None:
        catalog = self._safe_catalog()
        catalog["publications"] = [
            {},
            {"metadata": {"author": "Private writer"}, "links": []},
            {
                "metadata": {"title": "Private third"},
                "links": [{"rel": "download", "href": "/third.epub"}],
                "images": [{"href": "/third.svg", "type": "image/svg+xml"}],
            },
        ]

        _, report, output_path = self._run_catalog(catalog)
        by_code = {finding.code: finding for finding in report.findings}

        self.assertEqual(
            by_code["missing_publication_metadata"].locations,
            ("publication.1",),
        )
        self.assertEqual(
            by_code["missing_publication_title"].locations,
            ("publication.2",),
        )
        self.assertEqual(
            by_code["missing_public_acquisition"].locations,
            ("publication.1", "publication.2"),
        )
        self.assertEqual(
            by_code["missing_publication_images"].severity,
            "warning",
        )
        self.assertEqual(
            by_code["missing_supported_publication_image"].locations,
            ("publication.3",),
        )
        output = output_path.read_text(encoding="utf-8")
        self.assertNotIn("Private writer", output)
        self.assertNotIn("Private third", output)

    def test_reports_invalid_link_objects_and_blank_metadata(self) -> None:
        catalog = self._safe_catalog()
        catalog["metadata"] = {
            "title": "Private feed",
            "description": "",
        }
        catalog["links"] = [
            {"rel": "self", "href": "/opds"},
            "private bad link",
            {"rel": "alternate"},
            {"rel": "alternate", "href": "mailto:private@example.com"},
        ]

        _, report, output_path = self._run_catalog(catalog)
        by_code = {finding.code: finding for finding in report.findings}

        self.assertEqual(by_code["invalid_link_object"].locations, ("link.2",))
        self.assertEqual(by_code["missing_link_href"].locations, ("link.3",))
        self.assertEqual(by_code["invalid_link_href"].locations, ("link.4",))
        self.assertEqual(by_code["blank_metadata_value"].severity, "warning")
        output = output_path.read_text(encoding="utf-8")
        self.assertNotIn("private bad link", output)
        self.assertNotIn("private@example.com", output)

    def test_reports_duplicate_json_members_without_names_or_values(self) -> None:
        module = self._module()
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "catalog.json"
            target = directory / "report.md"
            source.write_text(
                '{"metadata":{"title":"Private first","title":"Private second"},'
                '"links":[{"rel":"self","href":"/opds"}],'
                '"navigation":[{"title":"Private nav","href":"/new"}]}',
                encoding="utf-8",
            )

            report = module.preflight_opds(source, target)

            finding = next(
                finding
                for finding in report.findings
                if finding.code == "duplicate_json_member"
            )
            self.assertEqual(finding.count, 1)
            output = target.read_text(encoding="utf-8")
            self.assertNotIn("Private first", output)
            self.assertNotIn("Private second", output)
            self.assertNotIn("Private nav", output)

    def test_accepts_safe_relative_links_and_open_access_aliases(self) -> None:
        catalog = self._safe_catalog()
        catalog["links"] = [{"rel": ["self"], "href": "/opds?page=1"}]
        publication = catalog["publications"][0]
        publication["links"] = [
            {
                "rel": "http://opds-spec.org/acquisition/open-access",
                "href": "books/one.epub",
            },
            {
                "rel": "http://opds-spec.org/acquisition/sample",
                "href": "/books/one-sample.epub",
            },
        ]

        _, report, _ = self._run_catalog(catalog)

        self.assertEqual(report.findings, ())

    def test_refuses_transactional_relations_and_price(self) -> None:
        module = self._module()
        for relation in (
            "acquisition",
            "buy",
            "borrow",
            "subscribe",
            "http://opds-spec.org/acquisition/buy",
            ["download", "buy", 7],
        ):
            with self.subTest(relation=relation), tempfile.TemporaryDirectory() as tmp:
                catalog = self._safe_catalog()
                catalog["publications"][0]["links"][0]["rel"] = relation
                source = Path(tmp) / "catalog.json"
                target = Path(tmp) / "report.md"
                source.write_text(json.dumps(catalog), encoding="utf-8")

                with self.assertRaisesRegex(
                    CsvShapeError,
                    "paid, borrowed, subscribed, or restricted catalogs "
                    "are not accepted",
                ):
                    module.preflight_opds(source, target)
                self.assertFalse(target.exists())

        with tempfile.TemporaryDirectory() as tmp:
            catalog = self._safe_catalog()
            catalog["publications"][0]["links"][0]["properties"] = {
                "price": {"currency": "USD", "value": 9.99}
            }
            source = Path(tmp) / "catalog.json"
            target = Path(tmp) / "report.md"
            source.write_text(json.dumps(catalog), encoding="utf-8")
            with self.assertRaisesRegex(
                CsvShapeError,
                "paid, borrowed, subscribed, or restricted catalogs are not accepted",
            ):
                module.preflight_opds(source, target)
            self.assertFalse(target.exists())

    def test_refuses_contact_authentication_and_private_markers(self) -> None:
        module = self._module()
        cases = (
            ("email", "publisher@example.com", "contact-email fields"),
            ("authentication", {"type": "basic"}, "authenticated or DRM-protected"),
            ("drm", "lcp", "authenticated or DRM-protected"),
            ("visibility", "private", "paid, borrowed, subscribed, or restricted"),
        )
        for key, value, message in cases:
            with self.subTest(key=key), tempfile.TemporaryDirectory() as tmp:
                catalog = self._safe_catalog()
                catalog["metadata"][key] = value
                source = Path(tmp) / "catalog.json"
                target = Path(tmp) / "report.md"
                source.write_text(json.dumps(catalog), encoding="utf-8")

                with self.assertRaisesRegex(CsvShapeError, message):
                    module.preflight_opds(source, target)
                self.assertFalse(target.exists())

        with tempfile.TemporaryDirectory() as tmp:
            catalog = self._safe_catalog()
            catalog["publications"][0]["links"][0]["rel"] = [
                "download",
                "http://opds-spec.org/authentication",
            ]
            source = Path(tmp) / "catalog.json"
            target = Path(tmp) / "report.md"
            source.write_text(json.dumps(catalog), encoding="utf-8")
            with self.assertRaisesRegex(
                CsvShapeError, "authenticated or DRM-protected"
            ):
                module.preflight_opds(source, target)
            self.assertFalse(target.exists())

    def test_refuses_nonpublic_or_tokenized_urls(self) -> None:
        module = self._module()
        risky_urls = (
            "http://localhost/opds",
            "http://127.0.0.1/opds",
            "http://10.1.2.3/opds",
            "https://user:secret@example.com/opds",
            "https://example.com/opds?access_token=private",
        )
        for risky_url in risky_urls:
            with (
                self.subTest(risky_url=risky_url),
                tempfile.TemporaryDirectory() as tmp,
            ):
                catalog = self._safe_catalog()
                catalog["links"][0]["href"] = risky_url
                source = Path(tmp) / "catalog.json"
                target = Path(tmp) / "report.md"
                source.write_text(json.dumps(catalog), encoding="utf-8")

                with self.assertRaisesRegex(
                    CsvShapeError,
                    "tokenized, local, or non-public URLs are not accepted",
                ):
                    module.preflight_opds(source, target)
                self.assertFalse(target.exists())

    def test_rejects_invalid_encoding_control_bytes_size_and_same_path(self) -> None:
        module = self._module()
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            target = directory / "report.md"

            invalid_encoding = directory / "invalid.json"
            invalid_encoding.write_bytes(b"\xff")
            with self.assertRaisesRegex(CsvShapeError, "expected UTF-8 OPDS JSON"):
                module.preflight_opds(invalid_encoding, target)

            controls = directory / "controls.json"
            controls.write_bytes(b'{"metadata":"bad\x01value"}')
            with self.assertRaisesRegex(CsvShapeError, "control bytes"):
                module.preflight_opds(controls, target)

            oversized = directory / "oversized.json"
            oversized.write_text("four", encoding="utf-8")
            with mock.patch.object(module, "MAX_OPDS_BYTES", 3), self.assertRaisesRegex(
                CsvShapeError, "no larger than 10 MB"
            ):
                module.preflight_opds(oversized, target)

            same = directory / "same.json"
            same.write_text("{}", encoding="utf-8")
            with self.assertRaisesRegex(
                CsvShapeError, "input and output must be different files"
            ):
                module.preflight_opds(same, same)


if __name__ == "__main__":
    unittest.main()
