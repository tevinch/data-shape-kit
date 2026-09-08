"""Value-free local checks for one public-event iCalendar snapshot."""

from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path

from .clean import CsvShapeError


MAX_CALENDAR_BYTES = 10 * 1024 * 1024
_TOKEN_PATTERN = re.compile(r"[A-Za-z0-9-]+")
_EXCLUDED_PROPERTIES = {"ATTENDEE", "ORGANIZER", "CONTACT"}
_EXCLUDED_CLASSES = {"PRIVATE", "CONFIDENTIAL"}


@dataclass(frozen=True, slots=True)
class CalendarFinding:
    code: str
    severity: str
    count: int
    lines: tuple[int, ...]


@dataclass(frozen=True, slots=True)
class CalendarPreflightReport:
    input_rows: int
    event_count: int
    findings: tuple[CalendarFinding, ...]


@dataclass(frozen=True, slots=True)
class _ContentLine:
    name: str
    parameters: dict[str, str]
    value: str
    line: int


@dataclass(slots=True)
class _Component:
    name: str
    line: int
    properties: list[_ContentLine] = field(default_factory=list)
    child_count: int = 0
    validated: bool = False


def _find_unquoted(value: str, delimiter: str) -> int:
    quoted = False
    escaped = False
    for index, character in enumerate(value):
        if escaped:
            escaped = False
        elif character == "\\":
            escaped = True
        elif character == '"':
            quoted = not quoted
        elif character == delimiter and not quoted:
            return index
    return -1


def _split_unquoted(value: str, delimiter: str) -> list[str]:
    parts: list[str] = []
    remaining = value
    while (index := _find_unquoted(remaining, delimiter)) >= 0:
        parts.append(remaining[:index])
        remaining = remaining[index + 1 :]
    parts.append(remaining)
    return parts


def _parse_content_line(value: str, line: int) -> _ContentLine | None:
    separator = _find_unquoted(value, ":")
    if separator < 1:
        return None
    left = value[:separator]
    content = value[separator + 1 :]
    segments = _split_unquoted(left, ";")
    name = segments[0].upper()
    if not _TOKEN_PATTERN.fullmatch(name):
        return None
    parameters: dict[str, str] = {}
    for segment in segments[1:]:
        if "=" not in segment:
            return None
        parameter_name, parameter_value = segment.split("=", 1)
        parameter_name = parameter_name.upper()
        if not _TOKEN_PATTERN.fullmatch(parameter_name) or not parameter_value:
            return None
        parameters[parameter_name] = parameter_value.strip('"')
    return _ContentLine(name, parameters, content, line)


def _calendar_date(value: str) -> date | None:
    if not re.fullmatch(r"\d{8}", value):
        return None
    try:
        return datetime.strptime(value, "%Y%m%d").date()
    except ValueError:
        return None


def _calendar_datetime(value: str) -> datetime | None:
    match = re.fullmatch(
        r"(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)",
        value,
    )
    if match is None:
        return None
    year, month, day, hour, minute, second = (
        int(part) for part in match.groups()[:6]
    )
    if second > 60:
        return None
    try:
        return datetime(year, month, day, hour, minute, min(second, 59))
    except ValueError:
        return None


def _date_value(
    content: _ContentLine,
) -> tuple[str, date | datetime, str] | None:
    value_type = content.parameters.get("VALUE", "DATE-TIME").upper()
    timezone = content.parameters.get("TZID", "")
    if value_type == "DATE":
        parsed_date = _calendar_date(content.value)
        if parsed_date is None or timezone:
            return None
        return "date", parsed_date, "date"
    if value_type != "DATE-TIME":
        return None
    parsed_datetime = _calendar_datetime(content.value)
    if parsed_datetime is None:
        return None
    is_utc = content.value.endswith("Z")
    if timezone and is_utc:
        return None
    zone_key = "UTC" if is_utc else timezone or "floating"
    return "datetime", parsed_datetime, zone_key


def _valid_dtstamp(content: _ContentLine) -> bool:
    return (
        not content.parameters
        and content.value.endswith("Z")
        and _calendar_datetime(content.value) is not None
    )


def _allowed_child(parent: str, child: str) -> bool:
    if parent == "VCALENDAR":
        return child not in {"VCALENDAR", "STANDARD", "DAYLIGHT", "VALARM"}
    if parent == "VTIMEZONE":
        return child in {"STANDARD", "DAYLIGHT"}
    if parent in {"VEVENT", "VTODO"}:
        return child == "VALARM"
    return False


def preflight_calendar(
    input_path: str | Path, output_path: str | Path
) -> CalendarPreflightReport:
    """Write supported public-event calendar findings without source values."""
    source = Path(input_path)
    target = Path(output_path)
    if source.resolve() == target.resolve():
        raise CsvShapeError("input and output must be different files")
    if source.stat().st_size > MAX_CALENDAR_BYTES:
        raise CsvShapeError("expected an iCalendar file no larger than 10 MB")

    try:
        text = source.read_bytes().decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise CsvShapeError("expected UTF-8 iCalendar text") from error
    if any(
        ord(character) < 32 and character not in "\t\n\r"
        for character in text
    ):
        raise CsvShapeError("iCalendar control bytes are not accepted")

    physical = text.splitlines(keepends=True)
    physical_content: list[str] = []
    buckets: dict[str, list[int]] = {}

    def record(code: str, *lines: int) -> None:
        buckets.setdefault(code, []).extend(lines)

    for line_number, raw_line in enumerate(physical, start=1):
        if not raw_line.endswith("\r\n"):
            record("non_crlf_line_ending", line_number)
        if raw_line.endswith("\r\n"):
            content = raw_line[:-2]
        elif raw_line.endswith(("\r", "\n")):
            content = raw_line[:-1]
        else:
            content = raw_line
        physical_content.append(content)
        if len(content.encode("utf-8")) > 75:
            record("long_content_line", line_number)

    logical: list[tuple[int, str]] = []
    for line_number, content in enumerate(physical_content, start=1):
        if content.startswith((" ", "\t")):
            if not logical:
                record("invalid_fold", line_number)
            else:
                first_line, previous = logical[-1]
                logical[-1] = (first_line, previous + content[1:])
            continue
        logical.append((line_number, content))

    parsed_lines: list[_ContentLine] = []
    for line_number, content in logical:
        parsed = _parse_content_line(content, line_number)
        if parsed is None:
            record("invalid_content_line", line_number)
            continue
        if parsed.name in _EXCLUDED_PROPERTIES:
            raise CsvShapeError("excluded calendar content is not accepted")
        if parsed.name == "METHOD" and parsed.value.strip().upper() != "PUBLISH":
            raise CsvShapeError("excluded calendar content is not accepted")
        if (
            parsed.name == "CLASS"
            and parsed.value.strip().upper() in _EXCLUDED_CLASSES
        ):
            raise CsvShapeError("excluded calendar content is not accepted")
        parsed_lines.append(parsed)

    stack: list[_Component] = []
    calendars: list[_Component] = []
    events: list[_Component] = []
    identifiers: defaultdict[str, list[int]] = defaultdict(list)

    def grouped(component: _Component) -> defaultdict[str, list[_ContentLine]]:
        result: defaultdict[str, list[_ContentLine]] = defaultdict(list)
        for item in component.properties:
            result[item.name].append(item)
        return result

    def validate_calendar(component: _Component) -> None:
        if component.validated:
            return
        component.validated = True
        properties = grouped(component)
        prodids = properties["PRODID"]
        versions = properties["VERSION"]
        if not prodids:
            record("missing_prodid")
        elif len(prodids) > 1:
            record("multiple_prodid", *(item.line for item in prodids))
        if not versions:
            record("missing_version")
        elif len(versions) > 1:
            record("multiple_version", *(item.line for item in versions))
        for item in versions:
            if item.value.strip() != "2.0":
                record("invalid_version", item.line)
        if component.child_count == 0:
            record("empty_calendar")

    def validate_event(component: _Component) -> None:
        if component.validated:
            return
        component.validated = True
        properties = grouped(component)
        for name, missing_code, multiple_code in (
            ("UID", "missing_uid", "multiple_uid"),
            ("DTSTAMP", "missing_dtstamp", "multiple_dtstamp"),
            ("DTSTART", "missing_dtstart", "multiple_dtstart"),
        ):
            items = properties[name]
            if not items:
                record(missing_code)
            elif len(items) > 1:
                record(multiple_code, *(item.line for item in items))

        for item in properties["UID"]:
            if not item.value:
                record("empty_uid", item.line)
            else:
                identifiers[item.value].append(item.line)
        for item in properties["DTSTAMP"]:
            if not _valid_dtstamp(item):
                record("invalid_dtstamp", item.line)

        starts = properties["DTSTART"]
        ends = properties["DTEND"]
        durations = properties["DURATION"]
        if len(ends) > 1:
            record("multiple_dtend", *(item.line for item in ends))
        if len(durations) > 1:
            record("multiple_duration", *(item.line for item in durations))

        parsed_starts: list[tuple[_ContentLine, tuple[str, date | datetime, str]]] = []
        parsed_ends: list[tuple[_ContentLine, tuple[str, date | datetime, str]]] = []
        for item in starts:
            parsed = _date_value(item)
            if parsed is None:
                record("invalid_dtstart", item.line)
            else:
                parsed_starts.append((item, parsed))
        for item in ends:
            parsed = _date_value(item)
            if parsed is None:
                record("invalid_dtend", item.line)
            else:
                parsed_ends.append((item, parsed))

        if ends and durations:
            record(
                "dtend_duration_conflict",
                *(item.line for item in ends + durations),
            )
        if len(parsed_starts) == 1 and len(parsed_ends) == 1:
            start_line, start = parsed_starts[0]
            end_line, end = parsed_ends[0]
            if start[0] != end[0]:
                record(
                    "mismatched_date_value_type",
                    start_line.line,
                    end_line.line,
                )
            elif start[2] == end[2] and end[1] <= start[1]:
                record(
                    "nonpositive_event_span",
                    start_line.line,
                    end_line.line,
                )

    def validate_component(component: _Component) -> None:
        if component.name == "VCALENDAR":
            validate_calendar(component)
        elif component.name == "VEVENT":
            validate_event(component)

    for content in parsed_lines:
        if content.name == "BEGIN":
            component_name = content.value.strip().upper()
            if not _TOKEN_PATTERN.fullmatch(component_name):
                record("invalid_component_name", content.line)
                continue
            component = _Component(component_name, content.line)
            if not stack:
                if component_name != "VCALENDAR":
                    record("component_outside_calendar", content.line)
                else:
                    calendars.append(component)
            else:
                parent = stack[-1]
                parent.child_count += 1
                if not _allowed_child(parent.name, component_name):
                    record("invalid_component_nesting", content.line)
            if component_name == "VEVENT":
                events.append(component)
            stack.append(component)
            continue

        if content.name == "END":
            component_name = content.value.strip().upper()
            if not stack:
                record("unmatched_component_end", content.line)
                continue
            component = stack.pop()
            if component.name != component_name:
                record("mismatched_component_end", content.line)
            validate_component(component)
            continue

        if not stack:
            record("property_outside_calendar", content.line)
        else:
            stack[-1].properties.append(content)

    for component in reversed(stack):
        record("unclosed_component", component.line)
        validate_component(component)
    if not calendars:
        record("missing_calendar")
    elif len(calendars) > 1:
        record("multiple_calendar", *(item.line for item in calendars))
    for lines in identifiers.values():
        if len(lines) > 1:
            record("duplicate_event_uid", *lines)

    ordered_codes = (
        ("non_crlf_line_ending", "warning"),
        ("long_content_line", "warning"),
        ("invalid_fold", "error"),
        ("invalid_content_line", "error"),
        ("component_outside_calendar", "error"),
        ("invalid_component_name", "error"),
        ("invalid_component_nesting", "error"),
        ("unmatched_component_end", "error"),
        ("mismatched_component_end", "error"),
        ("unclosed_component", "error"),
        ("property_outside_calendar", "error"),
        ("missing_calendar", "error"),
        ("multiple_calendar", "error"),
        ("missing_prodid", "error"),
        ("missing_version", "error"),
        ("multiple_prodid", "error"),
        ("multiple_version", "error"),
        ("invalid_version", "error"),
        ("empty_calendar", "error"),
        ("missing_uid", "error"),
        ("missing_dtstamp", "error"),
        ("missing_dtstart", "error"),
        ("multiple_uid", "error"),
        ("multiple_dtstamp", "error"),
        ("multiple_dtstart", "error"),
        ("multiple_dtend", "error"),
        ("multiple_duration", "error"),
        ("empty_uid", "error"),
        ("invalid_dtstamp", "error"),
        ("invalid_dtstart", "error"),
        ("invalid_dtend", "error"),
        ("dtend_duration_conflict", "error"),
        ("mismatched_date_value_type", "error"),
        ("nonpositive_event_span", "error"),
        ("duplicate_event_uid", "warning"),
    )
    findings = tuple(
        CalendarFinding(code, severity, len(lines) or 1, tuple(lines))
        for code, severity in ordered_codes
        if (lines := buckets.get(code)) is not None
    )
    report = CalendarPreflightReport(
        input_rows=len(physical),
        event_count=len(events),
        findings=findings,
    )
    _write_report(target, report)
    return report


def _write_report(target: Path, report: CalendarPreflightReport) -> None:
    lines = [
        "# Public event calendar preflight",
        "",
        f"- Physical lines: {report.input_rows}",
        f"- Events: {report.event_count}",
        f"- Findings: {len(report.findings)}",
        "",
    ]
    if report.findings:
        lines.extend(
            [
                "| Check | Severity | Count | Lines |",
                "| --- | --- | ---: | --- |",
            ]
        )
        lines.extend(
            f"| {finding.code} | {finding.severity} | {finding.count} | "
            f"{', '.join(str(line) for line in finding.lines) if finding.lines else '-'} |"
            for finding in report.findings
        )
    else:
        lines.append("No findings from the supported local checks.")
    lines.extend(
        [
            "",
            "This report contains finding codes, counts, and line numbers only; it does not include source calendar values.",
            "It does not import or subscribe, make network requests, inspect an account, send invitations, or modify the input.",
            "It does not evaluate complete recurrence or time-zone semantics, HTTP or MIME behavior, or platform state.",
            "It does not guarantee platform import, subscription refresh, interoperability, availability, traffic, or sales.",
        ]
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("\n".join(lines) + "\n", encoding="utf-8")
