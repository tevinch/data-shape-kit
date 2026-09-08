import importlib
import tempfile
import unittest
from pathlib import Path

from data_shape_kit.clean import CsvShapeError


class FeedPreflightTests(unittest.TestCase):
    def _module(self):
        try:
            return importlib.import_module("data_shape_kit.feed_preflight")
        except ModuleNotFoundError:
            self.fail("RSS/Atom feed preflight module is missing")

    def test_accepts_supported_rss_without_copying_values(self) -> None:
        module = self._module()
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "feed.xml"
            target = directory / "report.md"
            source.write_text(
                '<?xml version="1.0" encoding="UTF-8"?>\n'
                '<rss version="2.0"><channel>'
                '<title>Confidential-looking public title</title>'
                '<link>https://example.com/feed-home</link>'
                '<description>Owner-approved public description</description>'
                '<item><title>Public item</title><guid>public-guid-17</guid>'
                '<link>https://example.com/posts/17</link>'
                '<pubDate>Tue, 08 Sep 2026 10:00:00 +0000</pubDate>'
                '</item></channel></rss>',
                encoding="utf-8",
            )

            report = module.preflight_feed(source, target)

            self.assertEqual(
                report,
                module.FeedPreflightReport(
                    input_rows=1, feed_type="RSS 2.0", findings=()
                ),
            )
            output = target.read_text(encoding="utf-8")
            self.assertIn("Feed type: RSS 2.0", output)
            self.assertIn("Entries: 1", output)
            self.assertIn("does not include source feed values", output)
            for source_value in (
                "Confidential-looking public title",
                "feed-home",
                "Owner-approved public description",
                "public-guid-17",
                "posts/17",
            ):
                self.assertNotIn(source_value, output)

    def test_accepts_rss_date_variants_allowed_by_the_specification(self) -> None:
        module = self._module()
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "feed.xml"
            target = directory / "report.md"
            source.write_text(
                '<rss version="2.0"><channel><title>Public feed</title>'
                '<link>https://example.com</link><description>Public</description>'
                '<item><title>First</title><guid>first</guid>'
                '<pubDate>08 Sep 26 10:00 GMT</pubDate></item>'
                '<item><description>Second</description><guid>second</guid>'
                '<pubDate>Tue, 08 Sep 2026 10:00:00 EST</pubDate></item>'
                '</channel></rss>',
                encoding="utf-8",
            )

            report = module.preflight_feed(source, target)

            self.assertEqual(report.findings, ())

    def test_accepts_atom_with_feed_author_inheritance(self) -> None:
        module = self._module()
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "atom.xml"
            target = directory / "report.md"
            source.write_text(
                '<?xml version="1.0" encoding="UTF-8"?>\n'
                '<feed xmlns="http://www.w3.org/2005/Atom">'
                '<id>https://example.com/feed</id><title>Public updates</title>'
                '<updated>2026-09-08T10:00:00Z</updated>'
                '<author><name>Public publisher</name></author>'
                '<entry><id>urn:uuid:atom-entry-17</id>'
                '<title>Published entry</title>'
                '<updated>2026-09-08T10:00:00+00:00</updated>'
                '<link rel="alternate" href="https://example.com/posts/17"/>'
                '</entry><entry><id>urn:uuid:atom-entry-18</id>'
                '<title>Published content entry</title>'
                '<updated>2026-09-08T11:00:00Z</updated>'
                '<content>Owner-approved public body</content>'
                '</entry></feed>',
                encoding="utf-8",
            )

            report = module.preflight_feed(source, target)

            self.assertEqual(
                report,
                module.FeedPreflightReport(
                    input_rows=2, feed_type="Atom 1.0", findings=()
                ),
            )
            output = target.read_text(encoding="utf-8")
            self.assertIn("Feed type: Atom 1.0", output)
            self.assertIn("Entries: 2", output)
            for source_value in (
                "Public updates",
                "Public publisher",
                "atom-entry-17",
                "posts/17",
                "Owner-approved public body",
            ):
                self.assertNotIn(source_value, output)

    def test_accepts_atom_entry_authors_and_content_construct(self) -> None:
        module = self._module()
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "atom.xml"
            target = directory / "report.md"
            source.write_text(
                '<feed xmlns="http://www.w3.org/2005/Atom">'
                '<id>urn:uuid:feed-19</id><title>Public feed</title>'
                '<updated>2026-09-08T10:00:00Z</updated>'
                '<entry><id>urn:uuid:entry-19</id><title>Public entry</title>'
                '<updated>2026-09-08T10:00:00Z</updated>'
                '<author><name>Public publisher</name></author>'
                '<content type="text"></content></entry></feed>',
                encoding="utf-8",
            )

            report = module.preflight_feed(source, target)

            self.assertEqual(report.findings, ())

    def test_reports_each_invalid_atom_author_construct(self) -> None:
        module = self._module()
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "atom.xml"
            target = directory / "report.md"
            source.write_text(
                '<feed xmlns="http://www.w3.org/2005/Atom">'
                '<id>urn:uuid:feed-20</id><title>Public feed</title>'
                '<updated>2026-09-08T10:00:00Z</updated>'
                '<author><name>Public publisher</name></author><author/>'
                '<entry><id>urn:uuid:entry-20</id><title>Public entry</title>'
                '<updated>2026-09-08T10:00:00Z</updated>'
                '<author><name>Public writer</name></author><author/>'
                '<content>Public content</content></entry></feed>',
                encoding="utf-8",
            )

            report = module.preflight_feed(source, target)

            self.assertEqual(
                report.findings,
                (
                    module.FeedFinding(
                        "invalid_feed_author", "error", 1, ()
                    ),
                    module.FeedFinding(
                        "invalid_entry_author", "error", 1, (1,)
                    ),
                ),
            )

    def test_reports_rss_findings_without_feed_values(self) -> None:
        module = self._module()
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "rss.xml"
            target = directory / "report.md"
            source.write_text(
                '<rss version="2.0"><channel>'
                '<link>private-relative-home</link>'
                '<item><pubDate>private-bad-date</pubDate></item>'
                '<item><title>Private Two</title><guid>private-shared-id</guid>'
                '<link>https://example.com/private-shared-link</link></item>'
                '<item><description>Private Three</description>'
                '<guid>private-shared-id</guid>'
                '<link>https://example.com/private-shared-link</link></item>'
                '</channel></rss>',
                encoding="utf-8",
            )

            report = module.preflight_feed(source, target)

            self.assertEqual(
                report.findings,
                (
                    module.FeedFinding(
                        "missing_channel_title", "error", 1, ()
                    ),
                    module.FeedFinding(
                        "invalid_channel_link", "error", 1, ()
                    ),
                    module.FeedFinding(
                        "missing_channel_description", "error", 1, ()
                    ),
                    module.FeedFinding(
                        "missing_item_title_or_description", "error", 1, (1,)
                    ),
                    module.FeedFinding(
                        "missing_item_identifier", "warning", 1, (1,)
                    ),
                    module.FeedFinding(
                        "duplicate_item_guid", "error", 2, (2, 3)
                    ),
                    module.FeedFinding(
                        "duplicate_item_link", "warning", 2, (2, 3)
                    ),
                    module.FeedFinding(
                        "invalid_item_pub_date", "error", 1, (1,)
                    ),
                ),
            )
            output = target.read_text(encoding="utf-8")
            self.assertIn(
                "| duplicate_item_guid | error | 2 | 2, 3 |", output
            )
            for source_value in (
                "private-relative-home",
                "private-bad-date",
                "Private Two",
                "private-shared-id",
                "private-shared-link",
                "Private Three",
            ):
                self.assertNotIn(source_value, output)

    def test_reports_atom_findings_and_duplicate_positions_without_values(self) -> None:
        module = self._module()
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "atom.xml"
            target = directory / "report.md"
            source.write_text(
                '<feed xmlns="http://www.w3.org/2005/Atom">'
                '<updated>private-invalid-feed-date</updated>'
                '<entry></entry>'
                '<entry><id>urn:private:shared</id><title>Private Two</title>'
                '<updated>2026-09-08T10:00:00Z</updated>'
                '<author><name>Private Publisher</name></author>'
                '<link href="https://example.com/private-shared"/></entry>'
                '<entry><id>urn:private:shared</id><title>Private Three</title>'
                '<updated>private-invalid-entry-date</updated>'
                '<author></author>'
                '<link rel="alternate" '
                'href="https://example.com/private-shared"/></entry>'
                '</feed>',
                encoding="utf-8",
            )

            report = module.preflight_feed(source, target)

            self.assertEqual(
                report.findings,
                (
                    module.FeedFinding("missing_feed_id", "error", 1, ()),
                    module.FeedFinding("missing_feed_title", "error", 1, ()),
                    module.FeedFinding("invalid_feed_updated", "error", 1, ()),
                    module.FeedFinding("missing_entry_id", "error", 1, (1,)),
                    module.FeedFinding(
                        "missing_entry_title", "error", 1, (1,)
                    ),
                    module.FeedFinding(
                        "missing_entry_updated", "error", 1, (1,)
                    ),
                    module.FeedFinding(
                        "invalid_entry_updated", "error", 1, (3,)
                    ),
                    module.FeedFinding(
                        "missing_entry_author", "error", 1, (1,)
                    ),
                    module.FeedFinding(
                        "invalid_entry_author", "error", 1, (3,)
                    ),
                    module.FeedFinding(
                        "missing_entry_content_or_alternate_link",
                        "error",
                        1,
                        (1,),
                    ),
                    module.FeedFinding(
                        "duplicate_entry_id", "warning", 2, (2, 3)
                    ),
                    module.FeedFinding(
                        "duplicate_entry_alternate_link", "warning", 2, (2, 3)
                    ),
                ),
            )
            output = target.read_text(encoding="utf-8")
            self.assertIn(
                "| duplicate_entry_id | warning | 2 | 2, 3 |", output
            )
            for source_value in (
                "private-invalid-feed-date",
                "urn:private:shared",
                "Private Two",
                "Private Publisher",
                "private-shared",
                "private-invalid-entry-date",
            ):
                self.assertNotIn(source_value, output)

    def test_reports_rss_root_channel_and_atom_namespace_shape(self) -> None:
        module = self._module()
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            target = directory / "report.md"

            unsupported = directory / "unsupported.xml"
            unsupported.write_text(
                "<private-map><private-value/></private-map>", encoding="utf-8"
            )
            report = module.preflight_feed(unsupported, target)
            self.assertEqual(report.feed_type, "unknown")
            self.assertEqual(
                report.findings,
                (module.FeedFinding("invalid_root", "error", 1, ()),),
            )
            self.assertNotIn(
                "private-map", target.read_text(encoding="utf-8")
            )

            no_namespace = directory / "no-namespace.xml"
            no_namespace.write_text(
                "<feed><title>private-plain-feed</title></feed>",
                encoding="utf-8",
            )
            report = module.preflight_feed(no_namespace, target)
            self.assertEqual(report.feed_type, "unknown")
            self.assertEqual(
                report.findings,
                (
                    module.FeedFinding(
                        "invalid_atom_namespace", "error", 1, ()
                    ),
                ),
            )
            self.assertNotIn(
                "private-plain-feed", target.read_text(encoding="utf-8")
            )

            wrong_rss = directory / "wrong-rss.xml"
            wrong_rss.write_text(
                '<rss version="0.92"><channel/><channel/></rss>',
                encoding="utf-8",
            )
            report = module.preflight_feed(wrong_rss, target)
            self.assertEqual(report.feed_type, "RSS")
            self.assertEqual(
                report.findings,
                (
                    module.FeedFinding(
                        "invalid_rss_version", "error", 1, ()
                    ),
                    module.FeedFinding("multiple_channel", "error", 1, ()),
                ),
            )

            missing_channel = directory / "missing-channel.xml"
            missing_channel.write_text(
                '<rss version="2.0"></rss>', encoding="utf-8"
            )
            report = module.preflight_feed(missing_channel, target)
            self.assertEqual(
                report.findings,
                (module.FeedFinding("missing_channel", "error", 1, ()),),
            )

    def test_rejects_contact_fields_and_nonpublic_access_markers(self) -> None:
        module = self._module()
        unsafe_cases = (
            (
                "dtd.xml",
                '<!DOCTYPE rss [<!ENTITY private "value">]><rss/>',
                "DTD and entity",
            ),
            (
                "rss-contact.xml",
                '<rss version="2.0"><channel><managingEditor>'
                'private@example.com</managingEditor></channel></rss>',
                "contact-email fields",
            ),
            (
                "rss-author.xml",
                '<rss version="2.0"><channel><item><author>'
                'private@example.com</author></item></channel></rss>',
                "contact-email fields",
            ),
            (
                "atom-email.xml",
                '<feed xmlns="http://www.w3.org/2005/Atom"><author>'
                '<name>Public name</name><email>private@example.com</email>'
                '</author></feed>',
                "contact-email fields",
            ),
            (
                "contact-attribute.xml",
                '<rss version="2.0"><channel '
                'contact-email="private@example.com"/></rss>',
                "contact-email fields",
            ),
            (
                "userinfo.xml",
                '<rss version="2.0"><channel><link>'
                'https://private-user:private-pass@example.com/feed'
                '</link></channel></rss>',
                "authenticated, tokenized, or private",
            ),
            (
                "token.xml",
                '<rss version="2.0"><channel><link>'
                'https://example.com/feed?access_token=private-token'
                '</link></channel></rss>',
                "authenticated, tokenized, or private",
            ),
            (
                "private.xml",
                '<rss version="2.0"><channel><visibility>private</visibility>'
                '</channel></rss>',
                "authenticated, tokenized, or private",
            ),
            (
                "private-attribute.xml",
                '<rss version="2.0" visibility="restricted"><channel/>'
                '</rss>',
                "authenticated, tokenized, or private",
            ),
            (
                "local-network.xml",
                '<rss version="2.0"><channel><link>'
                'http://127.0.0.1/private-feed'
                '</link></channel></rss>',
                "authenticated, tokenized, or private",
            ),
        )
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            for filename, xml, message in unsafe_cases:
                with self.subTest(filename=filename):
                    source = directory / filename
                    target = directory / f"{filename}.md"
                    source.write_text(xml, encoding="utf-8")
                    with self.assertRaisesRegex(CsvShapeError, message):
                        module.preflight_feed(source, target)
                    self.assertFalse(target.exists())

    def test_rejects_unreadable_oversize_invalid_xml_and_same_path(self) -> None:
        module = self._module()
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            target = directory / "report.md"

            bad_encoding = directory / "bad-encoding.xml"
            bad_encoding.write_bytes(b"<rss>\xff</rss>")
            with self.assertRaisesRegex(CsvShapeError, "expected a UTF-8"):
                module.preflight_feed(bad_encoding, target)
            self.assertFalse(target.exists())

            malformed = directory / "malformed.xml"
            malformed.write_text("<rss><private>", encoding="utf-8")
            with self.assertRaisesRegex(
                CsvShapeError, "invalid RSS or Atom XML"
            ):
                module.preflight_feed(malformed, target)
            self.assertFalse(target.exists())

            too_large = directory / "too-large.xml"
            with too_large.open("wb") as handle:
                handle.truncate(module.MAX_FEED_BYTES + 1)
            with self.assertRaisesRegex(CsvShapeError, "10 MB"):
                module.preflight_feed(too_large, target)
            self.assertFalse(target.exists())

            valid = directory / "valid.xml"
            valid.write_text("<rss/>", encoding="utf-8")
            with self.assertRaisesRegex(CsvShapeError, "different files"):
                module.preflight_feed(valid, valid)


if __name__ == "__main__":
    unittest.main()
