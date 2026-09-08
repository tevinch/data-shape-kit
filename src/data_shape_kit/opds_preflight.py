"""Value-free local checks for one public OPDS 2.0 catalog snapshot."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from ipaddress import ip_address
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlsplit

from .clean import CsvShapeError

MAX_OPDS_BYTES = 10 * 1024 * 1024
_PUBLIC_ACQUISITION_RELATIONS = {
    "download",
    "preview",
    "http://opds-spec.org/acquisition/open-access",
    "http://opds-spec.org/acquisition/sample",
}
_TRANSACTIONAL_RELATIONS = {
    "acquisition",
    "buy",
    "borrow",
    "subscribe",
    "http://opds-spec.org/acquisition",
    "http://opds-spec.org/acquisition/buy",
    "http://opds-spec.org/acquisition/borrow",
    "http://opds-spec.org/acquisition/subscribe",
}
_AUTHENTICATION_RELATIONS = {
    "authenticate",
    "authentication",
    "drm",
    "http://opds-spec.org/authentication",
    "http://opds-spec.org/drm",
}
_SUPPORTED_IMAGE_TYPES = {
    "image/avif",
    "image/gif",
    "image/jpeg",
    "image/jxl",
    "image/png",
    "image/webp",
}
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
_CONTACT_KEYS = {"contactemail", "email"}
_AUTHENTICATION_KEYS = {
    "apikey",
    "auth",
    "authentication",
    "authorization",
    "credential",
    "credentials",
    "drm",
    "encrypted",
    "encryption",
    "password",
    "passcode",
    "secret",
    "session",
    "sessionid",
    "signature",
    "token",
    "accesstoken",
}
_PRIVATE_VALUES = {"confidential", "internal", "private", "restricted"}


@dataclass(frozen=True, slots=True)
class OpdsFinding:
    code: str
    severity: str
    count: int
    locations: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class OpdsPreflightReport:
    input_rows: int
    collection_count: int
    catalog_type: str
    findings: tuple[OpdsFinding, ...]


def _normalized_name(value: str) -> str:
    return re.sub(r"[-_.@]", "", value.casefold())


def _relations(value: Any) -> tuple[str, ...]:
    if isinstance(value, str) and value:
        return (value,)
    if isinstance(value, list) and value and all(
        isinstance(item, str) and item for item in value
    ):
        return tuple(value)
    return ()


def _relation_strings(value: Any) -> tuple[str, ...]:
    if isinstance(value, str):
        return (value,)
    if isinstance(value, list):
        return tuple(item for item in value if isinstance(item, str))
    return ()


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

    return (
        json.loads(
            value,
            object_pairs_hook=pairs_hook,
            parse_constant=reject_constant,
        ),
        duplicate_members,
    )


def _url_has_access_risk(value: str) -> bool:
    try:
        parsed = urlsplit(value.strip())
        _ = parsed.port
    except ValueError:
        return True
    if parsed.username is not None or parsed.password is not None:
        return True
    if any(
        _normalized_name(key) in _SENSITIVE_QUERY_KEYS
        for key, _ in parse_qsl(parsed.query, keep_blank_values=True)
    ):
        return True
    if parsed.scheme not in {"http", "https"} or parsed.hostname is None:
        return False
    hostname = parsed.hostname.casefold().rstrip(".")
    if hostname == "localhost" or hostname.endswith(
        (".localhost", ".local", ".internal", ".lan", ".home")
    ):
        return True
    try:
        return not ip_address(hostname).is_global
    except ValueError:
        return False


def _walk_safety(value: Any) -> None:
    if isinstance(value, list):
        for item in value:
            _walk_safety(item)
        return
    if not isinstance(value, dict):
        return

    for name, item in value.items():
        normalized = _normalized_name(name)
        if normalized in _CONTACT_KEYS:
            raise CsvShapeError("contact-email fields are not accepted")
        if normalized in _AUTHENTICATION_KEYS:
            raise CsvShapeError(
                "authenticated or DRM-protected catalogs are not accepted"
            )
        if normalized in {"price", "prices"}:
            raise CsvShapeError(
                "paid, borrowed, subscribed, or restricted catalogs are not accepted"
            )
        if normalized == "rel":
            relations = tuple(
                relation.casefold() for relation in _relation_strings(item)
            )
            if any(
                relation in _TRANSACTIONAL_RELATIONS
                or (
                    relation.startswith("http://opds-spec.org/acquisition/")
                    and relation not in _PUBLIC_ACQUISITION_RELATIONS
                )
                for relation in relations
            ):
                raise CsvShapeError(
                    "paid, borrowed, subscribed, or restricted catalogs "
                    "are not accepted"
                )
            if any(
                relation in _AUTHENTICATION_RELATIONS
                or relation.endswith(("/authentication", "/authenticate", "/drm"))
                for relation in relations
            ):
                raise CsvShapeError(
                    "authenticated or DRM-protected catalogs are not accepted"
                )
        if normalized in {"access", "visibility"} and (
            isinstance(item, str) and item.casefold().strip() in _PRIVATE_VALUES
        ):
            raise CsvShapeError(
                "paid, borrowed, subscribed, or restricted catalogs are not accepted"
            )
        if normalized in {"private", "restricted"} and not (
            item is None
            or item is False
            or item == 0
            or (
                isinstance(item, str)
                and item.casefold().strip() in {"", "0", "false", "no"}
            )
        ):
            raise CsvShapeError(
                "paid, borrowed, subscribed, or restricted catalogs are not accepted"
            )
        if (
            normalized in {"href", "url", "uri"}
            and isinstance(item, str)
            and _url_has_access_risk(item)
        ):
            raise CsvShapeError(
                "tokenized, local, or non-public URLs are not accepted"
            )
        _walk_safety(item)


def _valid_href(value: Any) -> bool:
    if (
        not isinstance(value, str)
        or not value
        or len(value) >= 2048
        or any(character.isspace() or character == "\\" for character in value)
    ):
        return False
    try:
        parsed = urlsplit(value)
        port = parsed.port
    except ValueError:
        return False
    if parsed.scheme:
        return (
            parsed.scheme in {"http", "https"}
            and parsed.hostname is not None
            and parsed.username is None
            and parsed.password is None
            and (port is None or 0 < port <= 65535)
            and not _url_has_access_risk(value)
        )
    return parsed.netloc == "" and not value.startswith("//")


def _blank_metadata(value: Any) -> bool:
    if isinstance(value, dict):
        return any(
            (isinstance(item, str) and not item.strip()) or _blank_metadata(item)
            for item in value.values()
        )
    if isinstance(value, list):
        return any(_blank_metadata(item) for item in value)
    return False


def _link_findings(
    links: Any,
    location_prefix: str,
    record: Any,
    *,
    require_rel: bool = True,
) -> list[dict[str, Any]]:
    if not isinstance(links, list):
        return []
    valid_links: list[dict[str, Any]] = []
    for number, link in enumerate(links, start=1):
        location = f"{location_prefix}.{number}"
        if not isinstance(link, dict):
            record("invalid_link_object", location)
            continue
        if "href" not in link or not link.get("href"):
            record("missing_link_href", location)
        elif not _valid_href(link["href"]):
            record("invalid_link_href", location)
        if require_rel and "rel" in link and not _relations(link["rel"]):
            record("invalid_link_rel", location)
        valid_links.append(link)
    return valid_links


def preflight_opds(
    input_path: str | Path, output_path: str | Path
) -> OpdsPreflightReport:
    """Write supported OPDS 2.0 findings without including catalog values."""
    source = Path(input_path)
    target = Path(output_path)
    if source.resolve() == target.resolve():
        raise CsvShapeError("input and output must be different files")
    if source.stat().st_size > MAX_OPDS_BYTES:
        raise CsvShapeError("expected OPDS JSON no larger than 10 MB")
    try:
        text = source.read_bytes().decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise CsvShapeError("expected UTF-8 OPDS JSON") from error
    if any(
        ord(character) < 32 and character not in "\t\n\r"
        for character in text
    ):
        raise CsvShapeError("OPDS JSON control bytes are not accepted")

    try:
        catalog, duplicate_members = _loads_json(text)
    except (ValueError, RecursionError):
        report = OpdsPreflightReport(
            input_rows=0,
            collection_count=0,
            catalog_type="OPDS 2.0",
            findings=(OpdsFinding("invalid_json_syntax", "error", 1, ()),),
        )
        _write_report(target, report)
        return report
    if not isinstance(catalog, dict):
        report = OpdsPreflightReport(
            input_rows=0,
            collection_count=0,
            catalog_type="OPDS 2.0",
            findings=(OpdsFinding("invalid_root", "error", 1, ()),),
        )
        _write_report(target, report)
        return report

    _walk_safety(catalog)
    buckets: dict[str, list[str]] = {}

    def record(code: str, location: str = "") -> None:
        buckets.setdefault(code, []).append(location)

    if duplicate_members:
        buckets["duplicate_json_member"] = [""] * duplicate_members

    metadata = catalog.get("metadata")
    if not isinstance(metadata, dict):
        record("missing_feed_metadata")
    elif not isinstance(metadata.get("title"), str) or not metadata["title"].strip():
        record("missing_feed_title")
    if isinstance(metadata, dict) and _blank_metadata(metadata):
        record("blank_metadata_value", "catalog")

    root_links = _link_findings(catalog.get("links"), "link", record)
    has_self = any(
        "self" in {relation.casefold() for relation in _relations(link.get("rel"))}
        and _valid_href(link.get("href"))
        for link in root_links
    )
    if not has_self:
        record("missing_feed_self_link")

    collection_names = ("navigation", "publications", "groups", "facets")
    collection_count = sum(
        1
        for name in collection_names
        if isinstance(catalog.get(name), list) and bool(catalog[name])
    )
    if not any(
        isinstance(catalog.get(name), list) and bool(catalog[name])
        for name in ("navigation", "publications", "groups")
    ):
        record("missing_catalog_collection")

    navigation = catalog.get("navigation")
    if isinstance(navigation, list):
        for number, link in enumerate(navigation, start=1):
            location = f"navigation.{number}"
            if not isinstance(link, dict):
                record("invalid_link_object", location)
                continue
            if not isinstance(link.get("title"), str) or not link["title"].strip():
                record("missing_navigation_title", location)
            _link_findings([link], "navigation-link", record)

    publication_count = 0

    def check_publications(publications: Any, prefix: str) -> None:
        nonlocal publication_count
        if not isinstance(publications, list):
            return
        for number, publication in enumerate(publications, start=1):
            publication_count += 1
            location = f"{prefix}.{number}"
            if not isinstance(publication, dict):
                record("invalid_publication_object", location)
                continue
            publication_metadata = publication.get("metadata")
            if not isinstance(publication_metadata, dict):
                record("missing_publication_metadata", location)
            else:
                if (
                    not isinstance(publication_metadata.get("title"), str)
                    or not publication_metadata["title"].strip()
                ):
                    record("missing_publication_title", location)
                if _blank_metadata(publication_metadata):
                    record("blank_metadata_value", location)

            publication_links = _link_findings(
                publication.get("links"), f"{location}.link", record
            )
            has_public_acquisition = any(
                bool(
                    {
                        relation.casefold()
                        for relation in _relations(link.get("rel"))
                    }
                    & _PUBLIC_ACQUISITION_RELATIONS
                )
                and _valid_href(link.get("href"))
                for link in publication_links
            )
            if not has_public_acquisition:
                record("missing_public_acquisition", location)

            images = publication.get("images")
            if not isinstance(images, list) or not images:
                record("missing_publication_images", location)
            else:
                image_links = _link_findings(
                    images, f"{location}.image", record, require_rel=False
                )
                if not any(
                    isinstance(image.get("type"), str)
                    and image["type"].casefold() in _SUPPORTED_IMAGE_TYPES
                    and _valid_href(image.get("href"))
                    for image in image_links
                ):
                    record("missing_supported_publication_image", location)

    check_publications(catalog.get("publications"), "publication")

    groups = catalog.get("groups")
    if isinstance(groups, list):
        for number, group in enumerate(groups, start=1):
            location = f"group.{number}"
            if not isinstance(group, dict):
                record("invalid_group_object", location)
                continue
            group_metadata = group.get("metadata")
            if (
                not isinstance(group_metadata, dict)
                or not isinstance(group_metadata.get("title"), str)
                or not group_metadata["title"].strip()
            ):
                record("missing_group_title", location)
            has_navigation = "navigation" in group
            has_publications = "publications" in group
            if has_navigation == has_publications:
                record("invalid_group_collections", location)
            if has_navigation and isinstance(group.get("navigation"), list):
                for item_number, link in enumerate(group["navigation"], start=1):
                    item_location = f"{location}.navigation.{item_number}"
                    if not isinstance(link, dict):
                        record("invalid_link_object", item_location)
                    else:
                        if (
                            not isinstance(link.get("title"), str)
                            or not link["title"].strip()
                        ):
                            record("missing_navigation_title", item_location)
                        _link_findings([link], f"{location}.navigation-link", record)
            check_publications(group.get("publications"), f"{location}.publication")

    facets = catalog.get("facets")
    if isinstance(facets, list):
        for number, facet in enumerate(facets, start=1):
            location = f"facet.{number}"
            if not isinstance(facet, dict):
                record("invalid_facet_object", location)
                continue
            facet_metadata = facet.get("metadata")
            if (
                not isinstance(facet_metadata, dict)
                or not isinstance(facet_metadata.get("title"), str)
                or not facet_metadata["title"].strip()
            ):
                record("missing_facet_title", location)
            facet_links = facet.get("links")
            _link_findings(facet_links, f"{location}.link", record)
            if not isinstance(facet_links, list) or len(facet_links) < 2:
                record("sparse_facet_links", location)

    ordered_codes = (
        ("missing_feed_metadata", "error"),
        ("missing_feed_title", "error"),
        ("missing_feed_self_link", "error"),
        ("missing_catalog_collection", "error"),
        ("duplicate_json_member", "warning"),
        ("blank_metadata_value", "warning"),
        ("invalid_link_object", "error"),
        ("missing_link_href", "error"),
        ("invalid_link_href", "error"),
        ("invalid_link_rel", "error"),
        ("missing_navigation_title", "error"),
        ("invalid_group_object", "error"),
        ("missing_group_title", "error"),
        ("invalid_group_collections", "error"),
        ("invalid_facet_object", "error"),
        ("missing_facet_title", "error"),
        ("sparse_facet_links", "warning"),
        ("invalid_publication_object", "error"),
        ("missing_publication_metadata", "error"),
        ("missing_publication_title", "error"),
        ("missing_public_acquisition", "error"),
        ("missing_publication_images", "warning"),
        ("missing_supported_publication_image", "error"),
    )
    findings = tuple(
        OpdsFinding(
            code,
            severity,
            len(locations),
            tuple(location for location in locations if location),
        )
        for code, severity in ordered_codes
        if (locations := buckets.get(code))
    )
    report = OpdsPreflightReport(
        input_rows=publication_count,
        collection_count=collection_count,
        catalog_type="OPDS 2.0",
        findings=findings,
    )
    _write_report(target, report)
    return report


def _write_report(target: Path, report: OpdsPreflightReport) -> None:
    lines = [
        "# OPDS 2.0 catalog preflight",
        "",
        f"- Catalog type: {report.catalog_type}",
        f"- Collections: {report.collection_count}",
        f"- Publications: {report.input_rows}",
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
            (
                "This report covers supported static checks and does not include "
                "source catalog values."
            ),
            (
                "It does not make network requests, inspect a reader or catalog "
                "server, authenticate, download publications, or modify the input."
            ),
            "It does not guarantee HTTP behavior, MIME handling, or reader acceptance.",
        ]
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("\n".join(lines) + "\n", encoding="utf-8")
