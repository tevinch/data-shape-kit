import tempfile
import unittest
from pathlib import Path

from data_shape_kit.clean import CsvShapeError
from data_shape_kit.podcast_feed_preflight import (
    MAX_PODCAST_FEED_BYTES,
    PodcastFeedPreflightReport,
    PodcastFinding,
    preflight_podcast_feed,
)


class PodcastFeedPreflightTests(unittest.TestCase):
    def test_accepts_supported_public_feed(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "feed.xml"
            target = directory / "preflight.md"
            source.write_text(
                '<?xml version="1.0" encoding="UTF-8"?>\n'
                '<rss version="2.0" '
                'xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">\n'
                "<channel>\n"
                "<title>Public Show</title>\n"
                "<link>https://example.com/show</link>\n"
                "<description>Public description</description>\n"
                '<itunes:image href="https://example.com/cover.jpg"/>\n'
                "<item>\n"
                "<title>Episode One</title>\n"
                "<guid>episode-one</guid>\n"
                "<pubDate>Tue, 08 Sep 2026 10:00:00 +0000</pubDate>\n"
                '<enclosure url="https://example.com/episode.mp3" '
                'length="12345" type="audio/mpeg"/>\n'
                "</item>\n"
                "</channel>\n"
                "</rss>\n",
                encoding="utf-8",
            )

            report = preflight_podcast_feed(source, target)

            self.assertEqual(
                report,
                PodcastFeedPreflightReport(input_rows=1, findings=()),
            )
            output = target.read_text(encoding="utf-8")
            self.assertIn("No findings from the supported local checks.", output)
            self.assertIn("does not include source feed values", output)

    def test_reports_supported_findings_without_feed_values(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "feed.xml"
            target = directory / "preflight.md"
            source.write_text(
                '<rss version="2.0" '
                'xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">'
                "<channel>"
                "<link>private-relative-show</link>"
                "<item>"
                '<enclosure url="private-relative-audio" '
                'length="-1" type="bad type"/>'
                "<pubDate>private-date</pubDate>"
                "</item>"
                "<item><title>Public Two</title><guid>private-shared-guid</guid>"
                '<enclosure url="https://example.com/shared.mp3" '
                'length="123" type="audio/mpeg"/></item>'
                "<item><title>Public Three</title><guid>private-shared-guid</guid>"
                '<enclosure url="https://example.com/shared.mp3" '
                'length="456" type="audio/mpeg"/></item>'
                "</channel></rss>",
                encoding="utf-8",
            )

            report = preflight_podcast_feed(source, target)

            self.assertEqual(report.input_rows, 3)
            self.assertEqual(
                report.findings,
                (
                    PodcastFinding("missing_channel_title", "error", 1, ()),
                    PodcastFinding("invalid_channel_link", "error", 1, ()),
                    PodcastFinding("missing_channel_description", "error", 1, ()),
                    PodcastFinding("missing_artwork", "error", 1, ()),
                    PodcastFinding("missing_episode_title", "error", 1, (1,)),
                    PodcastFinding("invalid_enclosure_url", "error", 1, (1,)),
                    PodcastFinding("invalid_enclosure_length", "error", 1, (1,)),
                    PodcastFinding("invalid_enclosure_type", "error", 1, (1,)),
                    PodcastFinding("missing_guid", "error", 1, (1,)),
                    PodcastFinding("duplicate_guid", "error", 2, (2, 3)),
                    PodcastFinding(
                        "duplicate_enclosure_url", "error", 2, (2, 3)
                    ),
                    PodcastFinding("invalid_pub_date", "error", 1, (1,)),
                ),
            )
            output = target.read_text(encoding="utf-8")
            self.assertIn("| duplicate_guid | error | 2 | 2, 3 |", output)
            self.assertIn("does not guarantee platform acceptance", output)
            for source_value in (
                "private-relative-show",
                "private-relative-audio",
                "private-date",
                "private-shared-guid",
                "shared.mp3",
                "Public Two",
            ):
                self.assertNotIn(source_value, output)

    def test_reports_root_channel_episode_and_enclosure_shape(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            target = directory / "preflight.md"

            unsupported = directory / "unsupported.xml"
            unsupported.write_text("<feed/>", encoding="utf-8")
            report = preflight_podcast_feed(unsupported, target)
            self.assertEqual(
                report.findings,
                (PodcastFinding("invalid_root", "error", 1, ()),),
            )

            wrong_version = directory / "wrong-version.xml"
            wrong_version.write_text(
                '<rss version="1.0"><channel/><channel/></rss>',
                encoding="utf-8",
            )
            report = preflight_podcast_feed(wrong_version, target)
            self.assertEqual(
                report.findings,
                (
                    PodcastFinding("invalid_version", "error", 1, ()),
                    PodcastFinding("multiple_channel", "error", 1, ()),
                ),
            )

            empty = directory / "empty.xml"
            empty.write_text(
                '<rss version="2.0"><channel><title>x</title>'
                "<link>https://example.com</link><description>x</description>"
                '<image href="https://example.com/cover.jpg"/>'
                "</channel></rss>",
                encoding="utf-8",
            )
            report = preflight_podcast_feed(empty, target)
            self.assertIn(
                PodcastFinding("missing_artwork", "error", 1, ()),
                report.findings,
            )
            self.assertIn(
                PodcastFinding("empty_feed", "error", 1, ()), report.findings
            )

    def test_reports_missing_or_multiple_enclosures(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "feed.xml"
            target = directory / "preflight.md"
            source.write_text(
                '<rss version="2.0" '
                'xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">'
                "<channel><title>x</title><link>https://example.com</link>"
                "<description>x</description>"
                '<itunes:image href="https://example.com/cover.jpg"/>'
                "<item><title>One</title><guid>one</guid></item>"
                "<item><title>Two</title><guid>two</guid>"
                '<enclosure url="https://example.com/one.mp3" length="1" '
                'type="audio/mpeg"/>'
                '<enclosure url="https://example.com/two.mp3" length="2" '
                'type="audio/mpeg"/>'
                "</item></channel></rss>",
                encoding="utf-8",
            )

            report = preflight_podcast_feed(source, target)

            self.assertEqual(
                report.findings,
                (
                    PodcastFinding("missing_enclosure", "error", 1, (1,)),
                    PodcastFinding("multiple_enclosure", "error", 1, (2,)),
                ),
            )

    def test_rejects_unsafe_unreadable_and_same_path_without_output(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            target = directory / "preflight.md"

            bad_encoding = directory / "bad-encoding.xml"
            bad_encoding.write_bytes(b"<rss>\xff</rss>")
            with self.assertRaisesRegex(CsvShapeError, "expected a UTF-8"):
                preflight_podcast_feed(bad_encoding, target)
            self.assertFalse(target.exists())

            unsafe = directory / "unsafe.xml"
            unsafe.write_text(
                '<!DOCTYPE rss [<!ENTITY private "value">]><rss/>',
                encoding="utf-8",
            )
            with self.assertRaisesRegex(CsvShapeError, "DTD and entity"):
                preflight_podcast_feed(unsafe, target)
            self.assertFalse(target.exists())

            too_large = directory / "too-large.xml"
            with too_large.open("wb") as handle:
                handle.truncate(MAX_PODCAST_FEED_BYTES + 1)
            with self.assertRaisesRegex(CsvShapeError, "10 MB"):
                preflight_podcast_feed(too_large, target)
            self.assertFalse(target.exists())

            valid = directory / "valid.xml"
            valid.write_text("<rss/>", encoding="utf-8")
            with self.assertRaisesRegex(CsvShapeError, "must be different files"):
                preflight_podcast_feed(valid, valid)


if __name__ == "__main__":
    unittest.main()
