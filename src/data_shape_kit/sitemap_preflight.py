"""Value-free local checks for one XML sitemap or sitemap index."""

from __future__ import annotations

import re
import xml.etree.ElementTree as ElementTree
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from urllib.parse import urlsplit

from .clean import CsvShapeError


SITEMAP_NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9"
MAX_SITEMAP_BYTES = 50 * 1024 * 1024
MAX_SITEMAP_ENTRIES = 50_000

_ALLOWED_CHANGEFREQ = {
    "always",
    "hourly",
    "daily",
    "weekly",
    "monthly",
    "yearly",
    "never",
}
_LASTMOD = re.compile(
    r"^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$"
)
_PRIORITY = re.compile(r"^(?:0(?:\.\d+)?|1(?:\.0+)?)$")
_UNSAFE_DECLARATION = re.compile(r"<!\s*(?:DOCTYPE|ENTITY)\b", re.IGNORECASE)


@dataclass(frozen=True, slots=True)
class SitemapFinding:
    code: str
    severity: str
    count: int
    entries: tuple[int, ...]


@dataclass(frozen=True, slots=True)
class SitemapPreflightReport:
    input_rows: int
    root_kind: str
    findings: tuple[SitemapFinding, ...]


def _split_tag(tag: str) -> tuple[str, str]:
    if tag.startswith("{") and "}" in tag:
        namespace, local_name = tag[1:].split("}", 1)
        return namespace, local_name
    return "", tag


def _children(
    entry: ElementTree.Element, name: str, namespace: str
) -> list[ElementTree.Element]:
    return [
        child
        for child in entry
        if _split_tag(child.tag) == (namespace, name)
    ]


def _public_origin(value: str) -> tuple[str, str, int | None] | None:
    if (
        not value
        or len(value) >= 2048
        or any(character.isspace() for character in value)
    ):
        return None
    try:
        parsed = urlsplit(value)
        port = parsed.port
    except ValueError:
        return None
    if (
        parsed.scheme not in {"http", "https"}
        or parsed.hostname is None
        or parsed.username is not None
        or parsed.password is not None
        or (port is not None and not 0 < port <= 65535)
    ):
        return None
    normalized_port = None
    if (parsed.scheme, port) not in {("http", 80), ("https", 443)}:
        normalized_port = port
    return parsed.scheme, parsed.hostname.lower(), normalized_port


def _valid_lastmod(value: str) -> bool:
    if _LASTMOD.fullmatch(value) is None:
        return False
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    return True


def _valid_priority(value: str) -> bool:
    if _PRIORITY.fullmatch(value) is None:
        return False
    try:
        priority = Decimal(value)
    except InvalidOperation:
        return False
    return Decimal("0") <= priority <= Decimal("1")


def preflight_sitemap(
    input_path: str | Path, output_path: str | Path
) -> SitemapPreflightReport:
    """Write supported static findings without including source URL values."""
    source = Path(input_path)
    target = Path(output_path)
    if source.resolve() == target.resolve():
        raise CsvShapeError("input and output must be different files")
    if source.stat().st_size > MAX_SITEMAP_BYTES:
        raise CsvShapeError("expected an uncompressed XML sitemap no larger than 50 MB")

    try:
        text = source.read_bytes().decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise CsvShapeError("expected a UTF-8 XML sitemap") from error
    if _UNSAFE_DECLARATION.search(text):
        raise CsvShapeError("DTD and entity declarations are not accepted")
    try:
        root = ElementTree.fromstring(text)
    except ElementTree.ParseError as error:
        raise CsvShapeError(f"invalid XML sitemap: {error}") from error

    root_namespace, root_kind = _split_tag(root.tag)
    buckets: dict[str, list[int]] = {}

    def record(code: str, entry_number: int) -> None:
        buckets.setdefault(code, []).append(entry_number)

    root_findings: list[SitemapFinding] = []
    if root_kind not in {"urlset", "sitemapindex"}:
        report = SitemapPreflightReport(
            input_rows=0,
            root_kind="unsupported",
            findings=(SitemapFinding("invalid_root", "error", 1, ()),),
        )
        _write_report(target, report)
        return report

    if root_namespace != SITEMAP_NAMESPACE:
        root_findings.append(SitemapFinding("invalid_namespace", "error", 1, ()))

    entry_name = "url" if root_kind == "urlset" else "sitemap"
    entries = [child for child in root if _split_tag(child.tag)[1] == entry_name]
    if not entries:
        root_findings.append(SitemapFinding("empty_sitemap", "error", 1, ()))
    if len(entries) > MAX_SITEMAP_ENTRIES:
        root_findings.append(SitemapFinding("too_many_entries", "error", 1, ()))

    locations: defaultdict[str, list[int]] = defaultdict(list)
    valid_origins: list[tuple[int, tuple[str, str, int | None]]] = []
    for entry_number, entry in enumerate(entries, start=1):
        entry_namespace, _ = _split_tag(entry.tag)
        if entry_namespace != root_namespace:
            record("invalid_entry_namespace", entry_number)
        location_nodes = _children(entry, "loc", entry_namespace)
        if not location_nodes:
            record("missing_loc", entry_number)
        elif len(location_nodes) > 1:
            record("multiple_loc", entry_number)
        else:
            location = (location_nodes[0].text or "").strip()
            origin = _public_origin(location)
            if origin is None:
                record("invalid_loc", entry_number)
            else:
                locations[location].append(entry_number)
                valid_origins.append((entry_number, origin))

        lastmod_nodes = _children(entry, "lastmod", entry_namespace)
        if len(lastmod_nodes) > 1:
            record("multiple_lastmod", entry_number)
        elif len(lastmod_nodes) == 1:
            lastmod = (lastmod_nodes[0].text or "").strip()
            if not _valid_lastmod(lastmod):
                record("invalid_lastmod", entry_number)

        if root_kind == "urlset":
            changefreq_nodes = _children(entry, "changefreq", entry_namespace)
            if len(changefreq_nodes) > 1:
                record("multiple_changefreq", entry_number)
            elif len(changefreq_nodes) == 1:
                changefreq = (changefreq_nodes[0].text or "").strip()
                if changefreq not in _ALLOWED_CHANGEFREQ:
                    record("invalid_changefreq", entry_number)

            priority_nodes = _children(entry, "priority", entry_namespace)
            if len(priority_nodes) > 1:
                record("multiple_priority", entry_number)
            elif len(priority_nodes) == 1:
                priority = (priority_nodes[0].text or "").strip()
                if not _valid_priority(priority):
                    record("invalid_priority", entry_number)

    duplicate_entries = sorted(
        entry_number
        for entry_numbers in locations.values()
        if len(entry_numbers) > 1
        for entry_number in entry_numbers
    )
    if duplicate_entries:
        buckets["duplicate_loc"] = duplicate_entries

    if valid_origins:
        first_origin = valid_origins[0][1]
        different_origin_entries = [
            entry_number
            for entry_number, origin in valid_origins[1:]
            if origin != first_origin
        ]
        if different_origin_entries:
            buckets["multiple_origins"] = different_origin_entries

    ordered_codes = (
        ("invalid_entry_namespace", "error"),
        ("missing_loc", "error"),
        ("multiple_loc", "error"),
        ("invalid_loc", "error"),
        ("duplicate_loc", "error"),
        ("multiple_origins", "warning"),
        ("multiple_lastmod", "error"),
        ("invalid_lastmod", "error"),
        ("multiple_changefreq", "warning"),
        ("invalid_changefreq", "warning"),
        ("multiple_priority", "warning"),
        ("invalid_priority", "warning"),
    )
    findings = tuple(root_findings) + tuple(
        SitemapFinding(code, severity, len(entry_numbers), tuple(entry_numbers))
        for code, severity in ordered_codes
        if (entry_numbers := buckets.get(code))
    )
    report = SitemapPreflightReport(
        input_rows=len(entries),
        root_kind=root_kind,
        findings=findings,
    )
    _write_report(target, report)
    return report


def _write_report(target: Path, report: SitemapPreflightReport) -> None:
    lines = [
        "# XML sitemap preflight",
        "",
        f"- Root: {report.root_kind}",
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
            "This report covers supported static checks and does not include source URL values.",
            "It does not make network requests, inspect an account, or modify the input.",
            "It does not guarantee crawling or indexing, search visibility, ranking, traffic, or sales.",
        ]
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("\n".join(lines) + "\n", encoding="utf-8")
