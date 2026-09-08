import tempfile
import unittest
from pathlib import Path

from data_shape_kit.calendar_preflight import (
    MAX_CALENDAR_BYTES,
    CalendarFinding,
    CalendarPreflightReport,
    preflight_calendar,
)
from data_shape_kit.clean import CsvShapeError


class CalendarPreflightTests(unittest.TestCase):
    def test_accepts_supported_public_event_calendar(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "events.ics"
            target = directory / "preflight.md"
            source.write_bytes(
                b"BEGIN:VCALENDAR\r\n"
                b"VERSION:2.0\r\n"
                b"PRODID:-//Example//Public Events//EN\r\n"
                b"CALSCALE:GREGORIAN\r\n"
                b"METHOD:PUBLISH\r\n"
                b"BEGIN:VEVENT\r\n"
                b"UID:public-event-1@example.com\r\n"
                b"DTSTAMP:20260908T120000Z\r\n"
                b"DTSTART:20260910T120000Z\r\n"
                b"DTEND:20260910T130000Z\r\n"
                b"SUMMARY:Public event\r\n"
                b"CLASS:PUBLIC\r\n"
                b"END:VEVENT\r\n"
                b"END:VCALENDAR\r\n"
            )

            report = preflight_calendar(source, target)

            self.assertEqual(
                report,
                CalendarPreflightReport(
                    input_rows=14,
                    event_count=1,
                    findings=(),
                ),
            )
            output = target.read_text(encoding="utf-8")
            self.assertIn("No findings from the supported local checks.", output)
            self.assertIn("does not include source calendar values", output)
            self.assertIn("does not import or subscribe", output)

    def test_reports_supported_findings_without_calendar_values(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "events.ics"
            target = directory / "preflight.md"
            source.write_text(
                "BEGIN:VCALENDAR\r\n"
                "VERSION:1.0\r\n"
                "VERSION:2.0\r\n"
                "BEGIN:VEVENT\r\n"
                "UID:\r\n"
                "UID:private-uid\r\n"
                "DTSTAMP:private-stamp\r\n"
                "DTSTART;VALUE=DATE:20261340\r\n"
                "DTEND:20260910T130000Z\r\n"
                "DURATION:P1D\r\n"
                "SUMMARY:private title\r\n"
                "END:VEVENT\r\n"
                "BEGIN:VEVENT\r\n"
                "UID:private-uid\r\n"
                "DTSTAMP:20260908T120000Z\r\n"
                "DTSTART:20260910T120000Z\r\n"
                "END:VEVENT\r\n"
                "END:VCALENDAR\r\n",
                encoding="utf-8",
            )

            report = preflight_calendar(source, target)

            self.assertEqual(report.input_rows, 18)
            self.assertEqual(report.event_count, 2)
            self.assertEqual(
                report.findings,
                (
                    CalendarFinding("missing_prodid", "error", 1, ()),
                    CalendarFinding("multiple_version", "error", 2, (2, 3)),
                    CalendarFinding("invalid_version", "error", 1, (2,)),
                    CalendarFinding("multiple_uid", "error", 2, (5, 6)),
                    CalendarFinding("empty_uid", "error", 1, (5,)),
                    CalendarFinding("invalid_dtstamp", "error", 1, (7,)),
                    CalendarFinding("invalid_dtstart", "error", 1, (8,)),
                    CalendarFinding(
                        "dtend_duration_conflict", "error", 2, (9, 10)
                    ),
                    CalendarFinding(
                        "duplicate_event_uid", "warning", 2, (6, 14)
                    ),
                ),
            )
            output = target.read_text(encoding="utf-8")
            self.assertIn(
                "| duplicate_event_uid | warning | 2 | 6, 14 |", output
            )
            self.assertIn("does not guarantee platform import", output)
            for source_value in (
                "private-uid",
                "private-stamp",
                "private title",
            ):
                self.assertNotIn(source_value, output)

    def test_reports_line_folding_and_basic_file_shape(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "events.ics"
            target = directory / "preflight.md"
            source.write_text(
                " orphan fold\n"
                "not-a-content-line\n"
                "BEGIN:VCALENDAR\n"
                "VERSION:2.0\n"
                "PRODID:-//Example//Public Events//EN\n"
                "BEGIN:VEVENT\n"
                "UID:public-1\n"
                "DTSTAMP:20260908T120000Z\n"
                "DTSTART:20260910T120000Z\n"
                + "DESCRIPTION:"
                + "x" * 80
                + "\nEND:VEVENT\nEND:VCALENDAR\n",
                encoding="utf-8",
            )

            report = preflight_calendar(source, target)
            findings = {finding.code: finding for finding in report.findings}

            self.assertEqual(findings["non_crlf_line_ending"].count, 12)
            self.assertEqual(findings["invalid_fold"].lines, (1,))
            self.assertEqual(findings["invalid_content_line"].lines, (2,))
            self.assertEqual(findings["long_content_line"].lines, (10,))

    def test_reports_date_type_mismatch_and_nonpositive_span(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            source = directory / "events.ics"
            target = directory / "preflight.md"
            source.write_text(
                "BEGIN:VCALENDAR\r\n"
                "VERSION:2.0\r\n"
                "PRODID:-//Example//Public Events//EN\r\n"
                "BEGIN:VEVENT\r\n"
                "UID:public-1\r\n"
                "DTSTAMP:20260908T120000Z\r\n"
                "DTSTART;VALUE=DATE:20260910\r\n"
                "DTEND:20260910T130000Z\r\n"
                "END:VEVENT\r\n"
                "BEGIN:VEVENT\r\n"
                "UID:public-2\r\n"
                "DTSTAMP:20260908T120000Z\r\n"
                "DTSTART:20260910T130000Z\r\n"
                "DTEND:20260910T120000Z\r\n"
                "END:VEVENT\r\n"
                "END:VCALENDAR\r\n",
                encoding="utf-8",
            )

            report = preflight_calendar(source, target)

            self.assertIn(
                CalendarFinding(
                    "mismatched_date_value_type", "error", 2, (7, 8)
                ),
                report.findings,
            )
            self.assertIn(
                CalendarFinding(
                    "nonpositive_event_span", "error", 2, (13, 14)
                ),
                report.findings,
            )

    def test_rejects_contact_scheduling_and_nonpublic_content(self) -> None:
        excluded_lines = (
            "ATTENDEE:mailto:private@example.com",
            "ORGANIZER:mailto:private@example.com",
            "CONTACT:Private person",
            "METHOD:REQUEST",
            "CLASS:PRIVATE",
            "CLASS:CONFIDENTIAL",
        )
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            target = directory / "preflight.md"
            for index, excluded_line in enumerate(excluded_lines, start=1):
                with self.subTest(excluded_line=excluded_line):
                    source = directory / f"excluded-{index}.ics"
                    source.write_text(
                        "BEGIN:VCALENDAR\r\n"
                        "VERSION:2.0\r\n"
                        "PRODID:-//Example//Public Events//EN\r\n"
                        "BEGIN:VEVENT\r\n"
                        "UID:public-1\r\n"
                        "DTSTAMP:20260908T120000Z\r\n"
                        "DTSTART:20260910T120000Z\r\n"
                        f"{excluded_line}\r\n"
                        "END:VEVENT\r\n"
                        "END:VCALENDAR\r\n",
                        encoding="utf-8",
                    )
                    with self.assertRaisesRegex(
                        CsvShapeError, "excluded calendar content"
                    ):
                        preflight_calendar(source, target)
                    self.assertFalse(target.exists())

    def test_rejects_unreadable_oversize_control_byte_and_same_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            target = directory / "preflight.md"

            bad_encoding = directory / "bad-encoding.ics"
            bad_encoding.write_bytes(b"BEGIN:VCALENDAR\r\n\xff")
            with self.assertRaisesRegex(CsvShapeError, "expected UTF-8"):
                preflight_calendar(bad_encoding, target)
            self.assertFalse(target.exists())

            control_byte = directory / "control-byte.ics"
            control_byte.write_text("BEGIN:VCALENDAR\x00", encoding="utf-8")
            with self.assertRaisesRegex(CsvShapeError, "control bytes"):
                preflight_calendar(control_byte, target)
            self.assertFalse(target.exists())

            too_large = directory / "too-large.ics"
            with too_large.open("wb") as handle:
                handle.truncate(MAX_CALENDAR_BYTES + 1)
            with self.assertRaisesRegex(CsvShapeError, "10 MB"):
                preflight_calendar(too_large, target)
            self.assertFalse(target.exists())

            valid = directory / "valid.ics"
            valid.write_text("BEGIN:VCALENDAR", encoding="utf-8")
            with self.assertRaisesRegex(CsvShapeError, "must be different files"):
                preflight_calendar(valid, valid)


if __name__ == "__main__":
    unittest.main()
