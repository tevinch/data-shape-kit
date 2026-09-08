"""Value-free local checks for one robots.txt file."""

from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlsplit

from .clean import CsvShapeError


MAX_ROBOTS_BYTES = 500 * 1024

_DIRECTIVE = re.compile(r"^\s*([A-Za-z-]+)\s*:(.*)$")
_USER_AGENT = re.compile(r"^(?:\*|[A-Za-z_-]+)$")
_SUPPORTED_FIELDS = {"user-agent", "allow", "disallow", "sitemap"}


@dataclass(frozen=True, slots=True)
class RobotsFinding:
    code: str
    severity: str
    count: int
    lines: tuple[int, ...]


@dataclass(frozen=True, slots=True)
class RobotsPreflightReport:
    input_rows: int
    group_count: int
    findings: tuple[RobotsFinding, ...]


@dataclass(slots=True)
class _RuleGroup:
    user_agents: list[tuple[str, int]] = field(default_factory=list)
    rules: list[tuple[str, str, int]] = field(default_factory=list)


def _valid_public_url(value: str) -> bool:
    if not value or len(value) > 2048 or any(character.isspace() for character in value):
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


def preflight_robots(
    input_path: str | Path, output_path: str | Path
) -> RobotsPreflightReport:
    """Write supported static findings without source directive values."""
    source = Path(input_path)
    target = Path(output_path)
    if source.resolve() == target.resolve():
        raise CsvShapeError("input and output must be different files")
    if source.stat().st_size > MAX_ROBOTS_BYTES:
        raise CsvShapeError("expected a robots.txt file no larger than 500 KiB")

    try:
        text = source.read_bytes().decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise CsvShapeError("expected a UTF-8 robots.txt file") from error

    source_lines = text.splitlines()
    groups: list[_RuleGroup] = []
    current_group: _RuleGroup | None = None
    sitemap_lines: defaultdict[str, list[int]] = defaultdict(list)
    buckets: dict[str, list[int]] = {}

    def record(code: str, line_number: int) -> None:
        buckets.setdefault(code, []).append(line_number)

    for line_number, raw_line in enumerate(source_lines, start=1):
        if any(ord(character) < 32 and character != "\t" for character in raw_line):
            record("invalid_line", line_number)
            continue
        content = raw_line.split("#", 1)[0].strip()
        if not content:
            continue
        match = _DIRECTIVE.fullmatch(content)
        if match is None:
            record("invalid_line", line_number)
            continue

        directive = match.group(1).lower()
        value = match.group(2).strip()
        if directive not in _SUPPORTED_FIELDS:
            record("unsupported_field", line_number)
            continue

        if directive == "user-agent":
            if _USER_AGENT.fullmatch(value) is None:
                record("invalid_user_agent", line_number)
                current_group = None
                continue
            if current_group is None or current_group.rules:
                current_group = _RuleGroup()
                groups.append(current_group)
            current_group.user_agents.append((value.lower(), line_number))
            continue

        if directive in {"allow", "disallow"}:
            if current_group is None:
                record("rule_without_user_agent", line_number)
                continue
            current_group.rules.append((directive, value, line_number))
            if value and not value.startswith("/"):
                record("invalid_rule_path", line_number)
            continue

        if not _valid_public_url(value):
            record("invalid_sitemap", line_number)
        else:
            sitemap_lines[value].append(line_number)

    duplicate_sitemap_lines = [
        line_number
        for lines in sitemap_lines.values()
        if len(lines) > 1
        for line_number in lines
    ]
    buckets["duplicate_sitemap"] = duplicate_sitemap_lines

    duplicate_rule_lines: list[int] = []
    conflicting_rule_lines: list[int] = []
    global_block_lines: list[int] = []
    rules_by_user_agent: defaultdict[
        str, list[tuple[str, str, int]]
    ] = defaultdict(list)
    for group in groups:
        for user_agent in {value for value, _ in group.user_agents}:
            rules_by_user_agent[user_agent].extend(group.rules)

    for user_agent, rules in rules_by_user_agent.items():
        exact_rules: defaultdict[tuple[str, str], list[int]] = defaultdict(list)
        path_rules: defaultdict[str, list[tuple[str, int]]] = defaultdict(list)
        for directive, value, line_number in rules:
            exact_rules[(directive, value)].append(line_number)
            path_rules[value].append((directive, line_number))

        duplicate_rule_lines.extend(
            line_number
            for lines in exact_rules.values()
            if len(lines) > 1
            for line_number in lines
        )
        for value, rules in path_rules.items():
            directives = {directive for directive, _ in rules}
            if value and directives == {"allow", "disallow"}:
                conflicting_rule_lines.extend(line_number for _, line_number in rules)

        root_disallow_lines = exact_rules.get(("disallow", "/"), [])
        root_allow_lines = exact_rules.get(("allow", "/"), [])
        if user_agent == "*" and root_disallow_lines and not root_allow_lines:
            global_block_lines.append(root_disallow_lines[0])

    buckets["duplicate_rule"] = duplicate_rule_lines
    buckets["conflicting_rule"] = conflicting_rule_lines
    buckets["global_crawl_block"] = global_block_lines

    ordered_codes = (
        ("invalid_line", "error"),
        ("invalid_user_agent", "error"),
        ("rule_without_user_agent", "error"),
        ("invalid_rule_path", "error"),
        ("duplicate_rule", "warning"),
        ("conflicting_rule", "warning"),
        ("invalid_sitemap", "error"),
        ("duplicate_sitemap", "warning"),
        ("unsupported_field", "warning"),
        ("global_crawl_block", "warning"),
    )
    findings = tuple(
        RobotsFinding(code, severity, len(lines), tuple(lines))
        for code, severity in ordered_codes
        if (raw_lines := buckets.get(code))
        and (lines := sorted(set(raw_lines)))
    )
    report = RobotsPreflightReport(
        input_rows=len(source_lines),
        group_count=len(groups),
        findings=findings,
    )
    lines = [
        "# robots.txt preflight",
        "",
        f"- Lines: {report.input_rows}",
        f"- Groups: {report.group_count}",
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
            f"{', '.join(str(line) for line in finding.lines)} |"
            for finding in report.findings
        )
    else:
        lines.append("No findings from the supported local checks.")
    lines.extend(
        [
            "",
            "This report covers supported static checks and does not include source directive values.",
            "It does not make network requests, inspect an account, or modify the input.",
            "It does not guarantee crawling or indexing, search visibility, ranking, traffic, or sales.",
        ]
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return report
