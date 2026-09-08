"""Value-free local checks for JSON-LD embedded in one HTML snapshot."""

from __future__ import annotations

import json
from collections import defaultdict
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

from .clean import CsvShapeError


MAX_JSON_LD_BYTES = 10 * 1024 * 1024
_JSON_LD_MEDIA_TYPE = "application/ld+json"


@dataclass(frozen=True, slots=True)
class JsonLdFinding:
    code: str
    severity: str
    count: int
    locations: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class JsonLdPreflightReport:
    input_rows: int
    object_count: int
    findings: tuple[JsonLdFinding, ...]


class _JsonLdParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.blocks: list[str] = []
        self._current: list[str] | None = None

    def handle_starttag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        if tag.lower() != "script" or self._current is not None:
            return
        attributes = {name.lower(): value or "" for name, value in attrs}
        media_type = attributes.get("type", "").split(";", 1)[0].strip().lower()
        if media_type == _JSON_LD_MEDIA_TYPE:
            self._current = []

    def handle_data(self, data: str) -> None:
        if self._current is not None:
            self._current.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "script" and self._current is not None:
            self.blocks.append("".join(self._current))
            self._current = None

    def finish(self) -> None:
        if self._current is not None:
            self.blocks.append("".join(self._current))
            self._current = None


def _valid_context(value: Any) -> bool:
    if value is None or isinstance(value, dict):
        return True
    if isinstance(value, str):
        return bool(value)
    if isinstance(value, list):
        return all(
            item is None
            or isinstance(item, dict)
            or (isinstance(item, str) and bool(item))
            for item in value
        )
    return False


def _valid_type(value: Any) -> bool:
    if isinstance(value, str):
        return bool(value)
    return (
        isinstance(value, list)
        and bool(value)
        and all(isinstance(item, str) and bool(item) for item in value)
    )


def _valid_graph(value: Any) -> bool:
    return isinstance(value, dict) or (
        isinstance(value, list) and all(isinstance(item, dict) for item in value)
    )


def _top_level_nodes(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, dict):
        return [value]
    if isinstance(value, list) and all(isinstance(item, dict) for item in value):
        return value
    return []


def _number_nodes(
    value: Any, script_number: int
) -> list[tuple[str, dict[str, Any]]]:
    numbered: list[tuple[str, dict[str, Any]]] = []
    pending = list(reversed(_top_level_nodes(value)))
    while pending:
        node = pending.pop()
        numbered.append((f"{script_number}.{len(numbered) + 1}", node))
        graph = node.get("@graph")
        if isinstance(graph, dict):
            pending.append(graph)
        elif isinstance(graph, list):
            pending.extend(
                item
                for item in reversed(graph)
                if isinstance(item, dict)
            )
    return numbered


def _loads_json(value: str) -> tuple[Any, int]:
    duplicate_members = 0

    def pairs_hook(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        nonlocal duplicate_members
        result: dict[str, Any] = {}
        for name, item in pairs:
            if name in result:
                duplicate_members += 1
            result[name] = item
        return result

    def reject_constant(_value: str) -> None:
        raise ValueError("non-finite JSON number")

    parsed = json.loads(
        value,
        object_pairs_hook=pairs_hook,
        parse_constant=reject_constant,
    )
    return parsed, duplicate_members


def preflight_json_ld(
    input_path: str | Path, output_path: str | Path
) -> JsonLdPreflightReport:
    """Write supported JSON-LD findings without including source values."""
    source = Path(input_path)
    target = Path(output_path)
    if source.resolve() == target.resolve():
        raise CsvShapeError("input and output must be different files")
    if source.stat().st_size > MAX_JSON_LD_BYTES:
        raise CsvShapeError("expected an HTML snapshot no larger than 10 MB")

    try:
        text = source.read_bytes().decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise CsvShapeError("expected UTF-8 HTML") from error
    if any(
        ord(character) < 32 and character not in "\t\n\r"
        for character in text
    ):
        raise CsvShapeError("HTML control bytes are not accepted")

    parser = _JsonLdParser()
    parser.feed(text)
    parser.close()
    parser.finish()

    if not parser.blocks:
        report = JsonLdPreflightReport(
            input_rows=0,
            object_count=0,
            findings=(
                JsonLdFinding("missing_json_ld_script", "error", 1, ()),
            ),
        )
        _write_report(target, report)
        return report

    buckets: dict[str, list[str]] = {}

    def record(code: str, location: str) -> None:
        buckets.setdefault(code, []).append(location)

    object_count = 0
    canonical_blocks: defaultdict[str, list[str]] = defaultdict(list)
    identifiers: defaultdict[str, list[str]] = defaultdict(list)

    for script_number, block in enumerate(parser.blocks, start=1):
        script_location = str(script_number)
        if not block.strip():
            record("empty_json_ld_script", script_location)
            continue
        try:
            parsed, duplicate_members = _loads_json(block)
        except (ValueError, RecursionError):
            record("invalid_json_syntax", script_location)
            continue

        if not isinstance(parsed, dict) and not (
            isinstance(parsed, list)
            and all(isinstance(item, dict) for item in parsed)
        ):
            record("invalid_top_level", script_location)
            continue
        if duplicate_members:
            buckets.setdefault("duplicate_json_member", []).extend(
                [script_location] * duplicate_members
            )

        canonical = json.dumps(
            parsed,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        canonical_blocks[canonical].append(script_location)

        top_level = _top_level_nodes(parsed)
        if not top_level:
            record("empty_top_level", script_location)
            continue
        numbered_nodes = _number_nodes(parsed, script_number)
        locations_by_identity = {
            id(node): location for location, node in numbered_nodes
        }
        for node in top_level:
            if "@context" not in node:
                record("missing_context", locations_by_identity[id(node)])

        object_count += len(numbered_nodes)
        for location, node in numbered_nodes:
            if "@context" in node and not _valid_context(node["@context"]):
                record("invalid_context_shape", location)
            if "@type" in node:
                if not _valid_type(node["@type"]):
                    record("invalid_type_shape", location)
            else:
                has_regular_property = any(
                    not name.startswith("@") for name in node
                )
                if has_regular_property:
                    record("missing_type", location)
            if "@id" in node:
                if not isinstance(node["@id"], str):
                    record("invalid_id_shape", location)
                else:
                    identifiers[node["@id"]].append(location)
            if "@graph" in node and not _valid_graph(node["@graph"]):
                record("invalid_graph_shape", location)

    duplicate_scripts: set[str] = set()
    for locations in canonical_blocks.values():
        if len(locations) > 1:
            buckets.setdefault("duplicate_json_ld_block", []).extend(locations)
            duplicate_scripts.update(locations)
    for locations in identifiers.values():
        distinct_block_locations = [
            location
            for location in locations
            if location.split(".", 1)[0] not in duplicate_scripts
        ]
        if len(distinct_block_locations) > 1:
            buckets.setdefault("repeated_id", []).extend(
                distinct_block_locations
            )

    ordered_codes = (
        ("empty_json_ld_script", "error"),
        ("invalid_json_syntax", "error"),
        ("invalid_top_level", "error"),
        ("empty_top_level", "warning"),
        ("duplicate_json_member", "warning"),
        ("invalid_context_shape", "error"),
        ("invalid_type_shape", "error"),
        ("invalid_id_shape", "error"),
        ("invalid_graph_shape", "error"),
        ("missing_context", "warning"),
        ("duplicate_json_ld_block", "warning"),
        ("missing_type", "warning"),
        ("repeated_id", "warning"),
    )
    findings = tuple(
        JsonLdFinding(code, severity, len(locations), tuple(locations))
        for code, severity in ordered_codes
        if (locations := buckets.get(code))
    )
    report = JsonLdPreflightReport(
        input_rows=len(parser.blocks),
        object_count=object_count,
        findings=findings,
    )
    _write_report(target, report)
    return report


def _write_report(target: Path, report: JsonLdPreflightReport) -> None:
    lines = [
        "# JSON-LD preflight",
        "",
        f"- JSON-LD scripts: {report.input_rows}",
        f"- Parsed objects: {report.object_count}",
        f"- Findings: {len(report.findings)}",
        "",
    ]
    if report.findings:
        lines.extend(
            [
                "| Check | Severity | Count | Locations |",
                "| --- | --- | ---: | --- |",
            ]
        )
        lines.extend(
            f"| {finding.code} | {finding.severity} | {finding.count} | "
            f"{', '.join(finding.locations) if finding.locations else '-'} |"
            for finding in report.findings
        )
    else:
        lines.append("No findings from the supported local checks.")
    lines.extend(
        [
            "",
            "Locations are script numbers or script.object numbers. This report does not include source JSON-LD values.",
            "It does not make network requests, inspect an account, or execute scripts. It does not resolve remote contexts, compare visible page content, or modify the input.",
            "It does not validate schema.org vocabulary, Google feature-specific requirements, content truthfulness, or policy compliance.",
            "It does not guarantee rich-result eligibility, appearance, ranking, traffic, or sales.",
        ]
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("\n".join(lines) + "\n", encoding="utf-8")
