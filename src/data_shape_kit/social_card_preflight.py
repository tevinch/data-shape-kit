"""Value-free local checks for Open Graph metadata in one HTML snapshot."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

from .clean import CsvShapeError


MAX_SOCIAL_CARD_BYTES = 10 * 1024 * 1024
_REQUIRED_PROPERTIES = ("og:title", "og:type", "og:image", "og:url")


@dataclass(frozen=True, slots=True)
class SocialCardFinding:
    code: str
    severity: str
    count: int
    metadata: tuple[int, ...]


@dataclass(frozen=True, slots=True)
class SocialCardPreflightReport:
    input_rows: int
    findings: tuple[SocialCardFinding, ...]


@dataclass(frozen=True, slots=True)
class _MetaTag:
    number: int
    in_head: bool
    attributes: dict[str, str]


class _MetadataParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.head_depth = 0
        self.metadata: list[_MetaTag] = []

    def handle_starttag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        normalized_tag = tag.lower()
        if normalized_tag == "head":
            self.head_depth += 1
            return
        if normalized_tag != "meta":
            return
        attributes = {
            name.lower(): value or ""
            for name, value in attrs
        }
        self.metadata.append(
            _MetaTag(
                number=len(self.metadata) + 1,
                in_head=self.head_depth > 0,
                attributes=attributes,
            )
        )

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "head" and self.head_depth:
            self.head_depth -= 1


def _valid_public_url(value: str) -> bool:
    if not value or len(value) >= 2048 or any(character.isspace() for character in value):
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


def preflight_social_card(
    input_path: str | Path, output_path: str | Path
) -> SocialCardPreflightReport:
    """Write supported findings without including source metadata values."""
    source = Path(input_path)
    target = Path(output_path)
    if source.resolve() == target.resolve():
        raise CsvShapeError("input and output must be different files")
    if source.stat().st_size > MAX_SOCIAL_CARD_BYTES:
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

    parser = _MetadataParser()
    parser.feed(text)
    parser.close()

    properties: defaultdict[str, list[_MetaTag]] = defaultdict(list)
    outside_head: list[int] = []
    for meta in parser.metadata:
        property_name = meta.attributes.get("property", "").strip()
        if not property_name.startswith("og:"):
            continue
        if not meta.in_head:
            outside_head.append(meta.number)
            continue
        properties[property_name].append(meta)

    root_findings: list[SocialCardFinding] = []
    for property_name in _REQUIRED_PROPERTIES:
        if not properties[property_name]:
            root_findings.append(
                SocialCardFinding(
                    f"missing_{property_name.replace(':', '_')}",
                    "error",
                    1,
                    (),
                )
            )
    if not properties["og:description"]:
        root_findings.append(
            SocialCardFinding("missing_og_description", "warning", 1, ())
        )

    buckets: dict[str, list[int]] = {}

    def record(code: str, number: int) -> None:
        buckets.setdefault(code, []).append(number)

    for property_name in (*_REQUIRED_PROPERTIES, "og:description"):
        code_name = property_name.replace(":", "_")
        tags = properties[property_name]
        for meta in tags:
            if not meta.attributes.get("content", "").strip():
                record(f"empty_{code_name}", meta.number)
        if property_name in {"og:title", "og:type", "og:url"} and len(tags) > 1:
            buckets[f"multiple_{code_name}"] = [meta.number for meta in tags]

    image_values: defaultdict[str, list[int]] = defaultdict(list)
    for meta in properties["og:image"]:
        value = meta.attributes.get("content", "").strip()
        if value and not _valid_public_url(value):
            record("invalid_og_image_url", meta.number)
        if value:
            image_values[value].append(meta.number)
    for meta in properties["og:url"]:
        value = meta.attributes.get("content", "").strip()
        if value and not _valid_public_url(value):
            record("invalid_og_url", meta.number)

    buckets["duplicate_og_image"] = [
        number
        for numbers in image_values.values()
        if len(numbers) > 1
        for number in numbers
    ]
    if properties["og:image"] and not any(
        meta.attributes.get("content", "").strip()
        for meta in properties["og:image:alt"]
    ):
        root_findings.append(
            SocialCardFinding("missing_og_image_alt", "warning", 1, ())
        )

    for suffix in ("width", "height"):
        for meta in properties[f"og:image:{suffix}"]:
            value = meta.attributes.get("content", "").strip()
            if not value.isascii() or not value.isdigit() or int(value) < 1:
                record(f"invalid_og_image_{suffix}", meta.number)

    buckets["og_metadata_outside_head"] = outside_head
    ordered_codes = (
        ("empty_og_title", "error"),
        ("empty_og_type", "error"),
        ("empty_og_image", "error"),
        ("empty_og_url", "error"),
        ("empty_og_description", "warning"),
        ("multiple_og_title", "warning"),
        ("multiple_og_type", "warning"),
        ("multiple_og_url", "warning"),
        ("invalid_og_image_url", "error"),
        ("invalid_og_url", "error"),
        ("duplicate_og_image", "warning"),
        ("invalid_og_image_width", "warning"),
        ("invalid_og_image_height", "warning"),
        ("og_metadata_outside_head", "warning"),
    )
    generated_findings = tuple(
        SocialCardFinding(code, severity, len(numbers), tuple(numbers))
        for code, severity in ordered_codes
        if (numbers := buckets.get(code))
    )

    image_alt_findings = tuple(
        finding
        for finding in root_findings
        if finding.code == "missing_og_image_alt"
    )
    other_root_findings = tuple(
        finding
        for finding in root_findings
        if finding.code != "missing_og_image_alt"
    )
    duplicate_index = next(
        (
            index + 1
            for index, finding in enumerate(generated_findings)
            if finding.code == "duplicate_og_image"
        ),
        len(generated_findings),
    )
    findings = (
        other_root_findings
        + generated_findings[:duplicate_index]
        + image_alt_findings
        + generated_findings[duplicate_index:]
    )
    report = SocialCardPreflightReport(
        input_rows=len(parser.metadata), findings=findings
    )
    _write_report(target, report)
    return report


def _write_report(target: Path, report: SocialCardPreflightReport) -> None:
    lines = [
        "# Social card metadata preflight",
        "",
        f"- Meta tags: {report.input_rows}",
        f"- Findings: {len(report.findings)}",
        "",
    ]
    if report.findings:
        lines.extend(
            [
                "| Check | Severity | Count | Meta tags |",
                "| --- | --- | ---: | --- |",
            ]
        )
        lines.extend(
            f"| {finding.code} | {finding.severity} | {finding.count} | "
            f"{', '.join(str(number) for number in finding.metadata) if finding.metadata else '-'} |"
            for finding in report.findings
        )
    else:
        lines.append("No findings from the supported local checks.")
    lines.extend(
        [
            "",
            "This report covers supported static checks and does not include source metadata values.",
            "It does not make network requests, inspect an account, execute scripts, download images, or modify the input.",
            "It does not guarantee a preview, platform behavior, clicks, traffic, or sales.",
        ]
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("\n".join(lines) + "\n", encoding="utf-8")
