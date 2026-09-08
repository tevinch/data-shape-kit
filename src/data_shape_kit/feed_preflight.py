"""Value-free local checks for one public RSS or Atom feed file."""

from __future__ import annotations

import re
import xml.etree.ElementTree as ElementTree
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from email.utils import parsedate_to_datetime
from ipaddress import ip_address
from pathlib import Path
from urllib.parse import parse_qsl, urlsplit

from .clean import CsvShapeError


ATOM_NAMESPACE = "http://www.w3.org/2005/Atom"
MAX_FEED_BYTES = 10 * 1024 * 1024
_UNSAFE_DECLARATION = re.compile(r"<!\s*(?:DOCTYPE|ENTITY)\b", re.IGNORECASE)
_SENSITIVE_QUERY_KEYS = {
    "accesstoken",
    "apikey",
    "auth",
    "authentication",
    "authorization",
    "credential",
    "key",
    "password",
    "passcode",
    "secret",
    "session",
    "sessionid",
    "sig",
    "signature",
    "token",
    "xamzcredential",
    "xamzsecuritytoken",
    "xamzsignature",
    "xgoogcredential",
    "xgoogsignature",
}
_PRIVATE_VALUES = {"confidential", "internal", "private", "restricted"}
_RFC_2822_DATE = re.compile(
    r"^(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), )?"
    r"\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) "
    r"(?:\d{2}|\d{4}) \d{2}:\d{2}(?::\d{2})? "
    r"(?:UT|GMT|EST|EDT|CST|CDT|MST|MDT|PST|PDT|[A-IK-Z]|[+-]\d{4})$"
)
_RFC_3339_DATE_TIME = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?"
    r"(?:Z|[+-]\d{2}:\d{2})$"
)


@dataclass(frozen=True, slots=True)
class FeedFinding:
    code: str
    severity: str
    count: int
    entries: tuple[int, ...]


@dataclass(frozen=True, slots=True)
class FeedPreflightReport:
    input_rows: int
    feed_type: str
    findings: tuple[FeedFinding, ...]


def _text(element: ElementTree.Element, tag: str) -> str | None:
    child = next((child for child in element if child.tag == tag), None)
    if child is None:
        return None
    return (child.text or "").strip()


def _valid_public_url(value: str) -> bool:
    if (
        not value
        or len(value) >= 2048
        or any(character.isspace() for character in value)
    ):
        return False
    try:
        parsed = urlsplit(value)
        port = parsed.port
    except ValueError:
        return False
    return (
        parsed.scheme in {"http", "https"}
        and parsed.hostname is not None
        and parsed.username is None
        and parsed.password is None
        and (port is None or 0 < port <= 65535)
    )


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _normalized_name(value: str) -> str:
    return re.sub(r"[-_.]", "", value.casefold())


def _url_has_access_risk(value: str) -> bool:
    try:
        parsed = urlsplit(value.strip())
    except ValueError:
        return False
    if parsed.scheme not in {"http", "https"} or parsed.hostname is None:
        return False
    if parsed.username is not None or parsed.password is not None:
        return True
    hostname = parsed.hostname.casefold().rstrip(".")
    if hostname == "localhost" or hostname.endswith(
        (".localhost", ".local", ".internal", ".lan", ".home")
    ):
        return True
    try:
        if not ip_address(hostname).is_global:
            return True
    except ValueError:
        pass
    return any(
        _normalized_name(key) in _SENSITIVE_QUERY_KEYS
        for key, _ in parse_qsl(parsed.query, keep_blank_values=True)
    )


def _contains_contact_field(root: ElementTree.Element) -> bool:
    for element in root.iter():
        local_name = _normalized_name(_local_name(element.tag))
        if local_name in {
            "contactemail",
            "email",
            "managingeditor",
            "webmaster",
        }:
            return True
        if element.tag == "author":
            return True
        if any(
            _normalized_name(_local_name(attribute_name))
            in {"contactemail", "email", "managingeditor", "webmaster"}
            for attribute_name in element.attrib
        ):
            return True
    return False


def _contains_nonpublic_access_marker(root: ElementTree.Element) -> bool:
    for element in root.iter():
        local_name = _local_name(element.tag).casefold()
        value = (element.text or "").strip()
        if local_name == "private" and value.casefold() not in {
            "",
            "0",
            "false",
            "no",
        }:
            return True
        if local_name in {"access", "visibility"} and value.casefold() in (
            _PRIVATE_VALUES
        ):
            return True
        if _url_has_access_risk(value):
            return True
        for attribute_name, attribute_value in element.attrib.items():
            attribute_local_name = _local_name(attribute_name).casefold()
            if attribute_local_name == "private" and attribute_value.casefold() not in {
                "",
                "0",
                "false",
                "no",
            }:
                return True
            if (
                attribute_local_name in {"access", "visibility"}
                and attribute_value.casefold() in _PRIVATE_VALUES
            ):
                return True
            if _url_has_access_risk(attribute_value):
                return True
    return False


def _valid_rss_date(value: str) -> bool:
    if _RFC_2822_DATE.fullmatch(value) is None:
        return False
    try:
        parsed = parsedate_to_datetime(value)
    except (TypeError, ValueError, OverflowError):
        return False
    zone = value.rsplit(" ", 1)[-1]
    return parsed.tzinfo is not None or re.fullmatch(r"[A-IK-Z]", zone) is not None


def _valid_atom_date_time(value: str) -> bool:
    if _RFC_3339_DATE_TIME.fullmatch(value) is None:
        return False
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    return parsed.tzinfo is not None


def _atom_text(element: ElementTree.Element, name: str) -> str | None:
    tag = f"{{{ATOM_NAMESPACE}}}{name}"
    child = next((child for child in element if child.tag == tag), None)
    if child is None:
        return None
    return "".join(child.itertext()).strip()


def _valid_atom_author(element: ElementTree.Element) -> bool:
    return bool(_atom_text(element, "name"))


def _rss_report(
    root: ElementTree.Element, prefix: tuple[FeedFinding, ...] = ()
) -> FeedPreflightReport:
    channel = next(child for child in root if child.tag == "channel")
    entries = [child for child in channel if child.tag == "item"]
    findings = list(prefix)
    channel_title = _text(channel, "title")
    channel_link = _text(channel, "link")
    channel_description = _text(channel, "description")
    if not channel_title:
        findings.append(FeedFinding("missing_channel_title", "error", 1, ()))
    if not channel_link:
        findings.append(FeedFinding("missing_channel_link", "error", 1, ()))
    elif not _valid_public_url(channel_link):
        findings.append(FeedFinding("invalid_channel_link", "error", 1, ()))
    if not channel_description:
        findings.append(
            FeedFinding("missing_channel_description", "error", 1, ())
        )

    buckets: dict[str, list[int]] = {}
    guid_entries: defaultdict[str, list[int]] = defaultdict(list)
    link_entries: defaultdict[str, list[int]] = defaultdict(list)

    def record(code: str, entry_number: int) -> None:
        buckets.setdefault(code, []).append(entry_number)

    for entry_number, entry in enumerate(entries, start=1):
        title = _text(entry, "title")
        description = _text(entry, "description")
        guid = _text(entry, "guid")
        link = _text(entry, "link")
        pub_date = _text(entry, "pubDate")
        if not title and not description:
            record("missing_item_title_or_description", entry_number)
        if not guid and not link:
            record("missing_item_identifier", entry_number)
        if guid:
            guid_entries[guid].append(entry_number)
        if link:
            if _valid_public_url(link):
                link_entries[link].append(entry_number)
            else:
                record("invalid_item_link", entry_number)
        if pub_date is not None and not _valid_rss_date(pub_date):
            record("invalid_item_pub_date", entry_number)

    buckets["duplicate_item_guid"] = [
        entry_number
        for entry_numbers in guid_entries.values()
        if len(entry_numbers) > 1
        for entry_number in entry_numbers
    ]
    buckets["duplicate_item_link"] = [
        entry_number
        for entry_numbers in link_entries.values()
        if len(entry_numbers) > 1
        for entry_number in entry_numbers
    ]
    ordered_codes = (
        ("missing_item_title_or_description", "error"),
        ("missing_item_identifier", "warning"),
        ("invalid_item_link", "error"),
        ("duplicate_item_guid", "error"),
        ("duplicate_item_link", "warning"),
        ("invalid_item_pub_date", "error"),
    )
    findings.extend(
        FeedFinding(code, severity, len(numbers), tuple(numbers))
        for code, severity in ordered_codes
        if (numbers := buckets.get(code))
    )
    return FeedPreflightReport(
        input_rows=len(entries), feed_type="RSS 2.0", findings=tuple(findings)
    )


def _atom_report(root: ElementTree.Element) -> FeedPreflightReport:
    entry_tag = f"{{{ATOM_NAMESPACE}}}entry"
    author_tag = f"{{{ATOM_NAMESPACE}}}author"
    content_tag = f"{{{ATOM_NAMESPACE}}}content"
    link_tag = f"{{{ATOM_NAMESPACE}}}link"
    entries = [child for child in root if child.tag == entry_tag]
    findings: list[FeedFinding] = []

    feed_id = _atom_text(root, "id")
    feed_title = _atom_text(root, "title")
    feed_updated = _atom_text(root, "updated")
    feed_authors = [child for child in root if child.tag == author_tag]
    feed_author_validity = [
        _valid_atom_author(author) for author in feed_authors
    ]
    valid_feed_author = any(feed_author_validity)
    if not feed_id:
        findings.append(FeedFinding("missing_feed_id", "error", 1, ()))
    if not feed_title:
        findings.append(FeedFinding("missing_feed_title", "error", 1, ()))
    if not feed_updated:
        findings.append(FeedFinding("missing_feed_updated", "error", 1, ()))
    elif not _valid_atom_date_time(feed_updated):
        findings.append(FeedFinding("invalid_feed_updated", "error", 1, ()))
    if any(not valid for valid in feed_author_validity):
        findings.append(FeedFinding("invalid_feed_author", "error", 1, ()))

    buckets: dict[str, list[int]] = {}
    id_entries: defaultdict[str, list[int]] = defaultdict(list)
    alternate_entries: defaultdict[str, list[int]] = defaultdict(list)

    def record(code: str, entry_number: int) -> None:
        buckets.setdefault(code, []).append(entry_number)

    for entry_number, entry in enumerate(entries, start=1):
        entry_id = _atom_text(entry, "id")
        entry_title = _atom_text(entry, "title")
        entry_updated = _atom_text(entry, "updated")
        entry_authors = [child for child in entry if child.tag == author_tag]
        entry_author_validity = [
            _valid_atom_author(author) for author in entry_authors
        ]
        valid_entry_author = any(entry_author_validity)
        if not entry_id:
            record("missing_entry_id", entry_number)
        else:
            id_entries[entry_id].append(entry_number)
        if not entry_title:
            record("missing_entry_title", entry_number)
        if not entry_updated:
            record("missing_entry_updated", entry_number)
        elif not _valid_atom_date_time(entry_updated):
            record("invalid_entry_updated", entry_number)
        if any(not valid for valid in entry_author_validity):
            record("invalid_entry_author", entry_number)
        elif not entry_authors and not valid_feed_author:
            record("missing_entry_author", entry_number)

        content = next((child for child in entry if child.tag == content_tag), None)
        has_content = content is not None
        alternate_links = [
            child
            for child in entry
            if child.tag == link_tag
            and (child.get("rel") or "alternate").strip() == "alternate"
        ]
        valid_alternate_links: list[str] = []
        for link in alternate_links:
            href = (link.get("href") or "").strip()
            if _valid_public_url(href):
                valid_alternate_links.append(href)
            else:
                record("invalid_entry_alternate_link", entry_number)
        for href in set(valid_alternate_links):
            alternate_entries[href].append(entry_number)
        if not has_content and not valid_alternate_links:
            record("missing_entry_content_or_alternate_link", entry_number)

    buckets["duplicate_entry_id"] = [
        entry_number
        for entry_numbers in id_entries.values()
        if len(entry_numbers) > 1
        for entry_number in entry_numbers
    ]
    buckets["duplicate_entry_alternate_link"] = [
        entry_number
        for entry_numbers in alternate_entries.values()
        if len(entry_numbers) > 1
        for entry_number in entry_numbers
    ]
    ordered_codes = (
        ("missing_entry_id", "error"),
        ("missing_entry_title", "error"),
        ("missing_entry_updated", "error"),
        ("invalid_entry_updated", "error"),
        ("missing_entry_author", "error"),
        ("invalid_entry_author", "error"),
        ("invalid_entry_alternate_link", "error"),
        ("missing_entry_content_or_alternate_link", "error"),
        ("duplicate_entry_id", "warning"),
        ("duplicate_entry_alternate_link", "warning"),
    )
    findings.extend(
        FeedFinding(code, severity, len(numbers), tuple(numbers))
        for code, severity in ordered_codes
        if (numbers := buckets.get(code))
    )
    return FeedPreflightReport(
        input_rows=len(entries), feed_type="Atom 1.0", findings=tuple(findings)
    )


def preflight_feed(
    input_path: str | Path, output_path: str | Path
) -> FeedPreflightReport:
    """Write supported static findings without including source feed values."""
    source = Path(input_path)
    target = Path(output_path)
    if source.resolve() == target.resolve():
        raise CsvShapeError("input and output must be different files")
    if source.stat().st_size > MAX_FEED_BYTES:
        raise CsvShapeError("expected an RSS or Atom feed no larger than 10 MB")

    try:
        text = source.read_bytes().decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise CsvShapeError("expected a UTF-8 RSS or Atom feed") from error
    if _UNSAFE_DECLARATION.search(text):
        raise CsvShapeError("DTD and entity declarations are not accepted")
    try:
        root = ElementTree.fromstring(text)
    except ElementTree.ParseError as error:
        raise CsvShapeError(f"invalid RSS or Atom XML: {error}") from error
    if _contains_contact_field(root):
        raise CsvShapeError("contact-email fields are not accepted")
    if _contains_nonpublic_access_marker(root):
        raise CsvShapeError(
            "authenticated, tokenized, or private feeds are not accepted"
        )

    if root.tag == f"{{{ATOM_NAMESPACE}}}feed":
        report = _atom_report(root)
    elif root.tag == "feed":
        report = FeedPreflightReport(
            input_rows=0,
            feed_type="unknown",
            findings=(
                FeedFinding("invalid_atom_namespace", "error", 1, ()),
            ),
        )
    elif root.tag == "rss":
        root_findings: list[FeedFinding] = []
        valid_version = root.get("version") == "2.0"
        if not valid_version:
            root_findings.append(
                FeedFinding("invalid_rss_version", "error", 1, ())
            )
        channels = [child for child in root if child.tag == "channel"]
        if len(channels) != 1:
            code = "missing_channel" if not channels else "multiple_channel"
            root_findings.append(FeedFinding(code, "error", 1, ()))
            report = FeedPreflightReport(
                input_rows=0,
                feed_type="RSS 2.0" if valid_version else "RSS",
                findings=tuple(root_findings),
            )
        else:
            report = _rss_report(root, tuple(root_findings))
            if not valid_version:
                report = FeedPreflightReport(
                    input_rows=report.input_rows,
                    feed_type="RSS",
                    findings=report.findings,
                )
    else:
        report = FeedPreflightReport(
            input_rows=0,
            feed_type="unknown",
            findings=(FeedFinding("invalid_root", "error", 1, ()),),
        )
    _write_report(target, report)
    return report


def _write_report(target: Path, report: FeedPreflightReport) -> None:
    lines = [
        "# RSS or Atom feed preflight",
        "",
        f"- Feed type: {report.feed_type}",
        f"- Entries: {report.input_rows}",
        f"- Findings: {len(report.findings)}",
        "",
    ]
    if report.findings:
        lines.extend(
            [
                "| Check | Severity | Count | Entries |",
                "| --- | --- | ---: | --- |",
            ]
        )
        lines.extend(
            f"| {finding.code} | {finding.severity} | {finding.count} | "
            f"{', '.join(str(entry) for entry in finding.entries) if finding.entries else '-'} |"
            for finding in report.findings
        )
    else:
        lines.append("No findings from the supported local checks.")
    lines.extend(
        [
            "",
            "This report covers supported static checks and does not include source feed values.",
            "It does not make network requests, inspect an account or CMS, "
            "import, subscribe, or modify the input.",
            "It does not guarantee HTTP behavior, MIME handling, or reader acceptance.",
        ]
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("\n".join(lines) + "\n", encoding="utf-8")
