"""Value-free local checks for one public podcast RSS feed file."""

from __future__ import annotations

import re
import xml.etree.ElementTree as ElementTree
from collections import defaultdict
from dataclasses import dataclass
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlsplit

from .clean import CsvShapeError


ITUNES_NAMESPACE = "http://www.itunes.com/dtds/podcast-1.0.dtd"
MAX_PODCAST_FEED_BYTES = 10 * 1024 * 1024
_UNSAFE_DECLARATION = re.compile(r"<!\s*(?:DOCTYPE|ENTITY)\b", re.IGNORECASE)
_MIME_TYPE = re.compile(
    r"^[A-Za-z0-9!#$&^_.+-]+/[A-Za-z0-9!#$&^_.+-]+$"
)
_RFC_2822_DATE = re.compile(
    r"^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), "
    r"\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) "
    r"\d{4} \d{2}:\d{2}:\d{2} (?:[+-]\d{4}|[A-Z]{2,5})$"
)


@dataclass(frozen=True, slots=True)
class PodcastFinding:
    code: str
    severity: str
    count: int
    episodes: tuple[int, ...]


@dataclass(frozen=True, slots=True)
class PodcastFeedPreflightReport:
    input_rows: int
    findings: tuple[PodcastFinding, ...]


def _valid_public_url(value: str, *, ascii_only: bool = False) -> bool:
    if (
        not value
        or len(value) >= 2048
        or any(character.isspace() for character in value)
        or (ascii_only and not value.isascii())
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


def _valid_pub_date(value: str) -> bool:
    if _RFC_2822_DATE.fullmatch(value) is None:
        return False
    try:
        parsed = parsedate_to_datetime(value)
    except (TypeError, ValueError, OverflowError):
        return False
    return parsed.tzinfo is not None


def _text(element: ElementTree.Element, name: str) -> str | None:
    children = [child for child in element if child.tag == name]
    if not children:
        return None
    return (children[0].text or "").strip()


def preflight_podcast_feed(
    input_path: str | Path, output_path: str | Path
) -> PodcastFeedPreflightReport:
    """Write supported static findings without including source feed values."""
    source = Path(input_path)
    target = Path(output_path)
    if source.resolve() == target.resolve():
        raise CsvShapeError("input and output must be different files")
    if source.stat().st_size > MAX_PODCAST_FEED_BYTES:
        raise CsvShapeError("expected a podcast RSS feed no larger than 10 MB")

    try:
        text = source.read_bytes().decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise CsvShapeError("expected a UTF-8 podcast RSS feed") from error
    if _UNSAFE_DECLARATION.search(text):
        raise CsvShapeError("DTD and entity declarations are not accepted")
    try:
        root = ElementTree.fromstring(text)
    except ElementTree.ParseError as error:
        raise CsvShapeError(f"invalid podcast RSS XML: {error}") from error

    if root.tag != "rss":
        report = PodcastFeedPreflightReport(
            input_rows=0,
            findings=(PodcastFinding("invalid_root", "error", 1, ()),),
        )
        _write_report(target, report)
        return report

    root_findings: list[PodcastFinding] = []
    if root.get("version") != "2.0":
        root_findings.append(PodcastFinding("invalid_version", "error", 1, ()))
    channels = [child for child in root if child.tag == "channel"]
    if len(channels) != 1:
        code = "missing_channel" if not channels else "multiple_channel"
        report = PodcastFeedPreflightReport(
            input_rows=0,
            findings=tuple(root_findings)
            + (PodcastFinding(code, "error", 1, ()),),
        )
        _write_report(target, report)
        return report

    channel = channels[0]
    channel_title = _text(channel, "title")
    channel_link = _text(channel, "link")
    channel_description = _text(channel, "description")
    artwork = next(
        (
            child
            for child in channel
            if child.tag == f"{{{ITUNES_NAMESPACE}}}image"
        ),
        None,
    )
    if not channel_title:
        root_findings.append(
            PodcastFinding("missing_channel_title", "error", 1, ())
        )
    if channel_link is None or not channel_link:
        root_findings.append(
            PodcastFinding("missing_channel_link", "error", 1, ())
        )
    elif not _valid_public_url(channel_link):
        root_findings.append(
            PodcastFinding("invalid_channel_link", "error", 1, ())
        )
    if not channel_description:
        root_findings.append(
            PodcastFinding("missing_channel_description", "error", 1, ())
        )
    if artwork is None:
        root_findings.append(PodcastFinding("missing_artwork", "error", 1, ()))
    elif not _valid_public_url((artwork.get("href") or "").strip()):
        root_findings.append(
            PodcastFinding("invalid_artwork_url", "error", 1, ())
        )

    episodes = [child for child in channel if child.tag == "item"]
    if not episodes:
        root_findings.append(PodcastFinding("empty_feed", "error", 1, ()))

    buckets: dict[str, list[int]] = {}
    guid_episodes: defaultdict[str, list[int]] = defaultdict(list)
    enclosure_episodes: defaultdict[str, list[int]] = defaultdict(list)

    def record(code: str, episode_number: int) -> None:
        buckets.setdefault(code, []).append(episode_number)

    for episode_number, episode in enumerate(episodes, start=1):
        if not _text(episode, "title"):
            record("missing_episode_title", episode_number)

        enclosures = [child for child in episode if child.tag == "enclosure"]
        if not enclosures:
            record("missing_enclosure", episode_number)
        elif len(enclosures) > 1:
            record("multiple_enclosure", episode_number)
        else:
            enclosure = enclosures[0]
            enclosure_url = (enclosure.get("url") or "").strip()
            enclosure_length = (enclosure.get("length") or "").strip()
            enclosure_type = (enclosure.get("type") or "").strip()
            if not _valid_public_url(enclosure_url, ascii_only=True):
                record("invalid_enclosure_url", episode_number)
            else:
                enclosure_episodes[enclosure_url].append(episode_number)
            if not enclosure_length:
                record("missing_enclosure_length", episode_number)
            elif not enclosure_length.isascii() or not enclosure_length.isdigit():
                record("invalid_enclosure_length", episode_number)
            if not enclosure_type:
                record("missing_enclosure_type", episode_number)
            elif _MIME_TYPE.fullmatch(enclosure_type) is None:
                record("invalid_enclosure_type", episode_number)

        guid = _text(episode, "guid")
        if not guid:
            record("missing_guid", episode_number)
        else:
            guid_episodes[guid].append(episode_number)

        pub_date = _text(episode, "pubDate")
        if pub_date is not None and not _valid_pub_date(pub_date):
            record("invalid_pub_date", episode_number)

    buckets["duplicate_guid"] = [
        episode_number
        for episode_numbers in guid_episodes.values()
        if len(episode_numbers) > 1
        for episode_number in episode_numbers
    ]
    buckets["duplicate_enclosure_url"] = [
        episode_number
        for episode_numbers in enclosure_episodes.values()
        if len(episode_numbers) > 1
        for episode_number in episode_numbers
    ]
    ordered_codes = (
        ("missing_episode_title", "error"),
        ("missing_enclosure", "error"),
        ("multiple_enclosure", "error"),
        ("invalid_enclosure_url", "error"),
        ("missing_enclosure_length", "error"),
        ("invalid_enclosure_length", "error"),
        ("missing_enclosure_type", "error"),
        ("invalid_enclosure_type", "error"),
        ("missing_guid", "error"),
        ("duplicate_guid", "error"),
        ("duplicate_enclosure_url", "error"),
        ("invalid_pub_date", "error"),
    )
    findings = tuple(root_findings) + tuple(
        PodcastFinding(code, severity, len(numbers), tuple(numbers))
        for code, severity in ordered_codes
        if (numbers := buckets.get(code))
    )
    report = PodcastFeedPreflightReport(
        input_rows=len(episodes), findings=findings
    )
    _write_report(target, report)
    return report


def _write_report(target: Path, report: PodcastFeedPreflightReport) -> None:
    lines = [
        "# Podcast RSS feed preflight",
        "",
        f"- Episodes: {report.input_rows}",
        f"- Findings: {len(report.findings)}",
        "",
    ]
    if report.findings:
        lines.extend(
            [
                "| Check | Severity | Count | Episodes |",
                "| --- | --- | ---: | --- |",
            ]
        )
        lines.extend(
            f"| {finding.code} | {finding.severity} | {finding.count} | "
            f"{', '.join(str(episode) for episode in finding.episodes) if finding.episodes else '-'} |"
            for finding in report.findings
        )
    else:
        lines.append("No findings from the supported local checks.")
    lines.extend(
        [
            "",
            "This report covers supported static checks and does not include source feed values.",
            "It does not make network requests, inspect an account, download media, or modify the input.",
            "It does not guarantee platform acceptance, listing, availability, playback, traffic, or sales.",
        ]
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("\n".join(lines) + "\n", encoding="utf-8")
