# RSS and Atom Feed Preflight Checklist

Last verified: 2026-09-09

Use this checklist to review one already-public RSS 2.0 or Atom 1.0 XML snapshot before its owner handles publication or reader testing. This project is independent and is not endorsed by the RSS Advisory Board, IETF, W3C, any publishing platform, or any feed reader. It does not access a website, server, hosting account, content-management system, or reader account.

## Current primary references

The RSS 2.0 specification defines an `rss` root with version `2.0`, exactly one `channel`, required channel `title`, `link`, and `description` elements, and the supported item identifier and date fields. RFC 4287 defines the Atom namespace, required feed and entry metadata, author inheritance, alternate links, content constructs, unique identifiers, and date-time syntax. W3C's Feed Validation Service documentation is included as a complementary public validation reference, not as a promise that this local report will match every validator or reader.

- [RSS 2.0 specification](https://www.rssboard.org/rss-specification)
- [RFC 4287: The Atom Syndication Format](https://www.rfc-editor.org/rfc/rfc4287.html)
- [W3C Feed Validation Service documentation](https://validator.w3.org/feed/docs/)

Specifications, validators, and reader behavior can change. Recheck the primary references before publication.

## Prepare an eligible file

- Use one uncompressed UTF-8 XML snapshot no larger than 10 MB.
- Use either RSS 2.0 with exactly one `channel` or Atom 1.0 with the exact `http://www.w3.org/2005/Atom` namespace.
- For RSS, include channel title, an absolute public HTTP(S) link, and description. Give each item a title or description and a valid RSS/RFC 822 publication date when one is present. A GUID or public link is strongly recommended for stable reader behavior; its absence is reported as a warning rather than proof that RSS 2.0 is invalid.
- For Atom, include feed and entry identifiers, titles, and RFC 3339 `updated` values. Provide an author name at feed level or on each entry, and give each entry a content construct or absolute public HTTP(S) alternate link.
- Use an invented excerpt or content that is already public. Real work accepts only a public RSS 2.0 or Atom 1.0 snapshot supplied by its owner or controller.
- Remove every contact-email field. Do not include authenticated, tokenized, or private URLs or access markers.
- Exclude private, paid-subscriber, password-protected, personalized, regulated, confidential, personal, identity, credential-bearing, unpublished, or production feeds.

## Run the local report

Install the immutable public version:

```bash
python -m pip install "data-shape-kit @ https://github.com/tevinch/data-shape-kit/archive/refs/tags/v0.17.0.tar.gz"
```

Run the preflight:

```bash
data-shape-kit --feed-preflight feed.xml preflight.md
```

The report covers supported static findings, including:

- `invalid_root`, `invalid_atom_namespace`, `invalid_rss_version`, `missing_channel`, and `multiple_channel`;
- `missing_channel_title`, `missing_channel_link`, `invalid_channel_link`, and `missing_channel_description`;
- `missing_item_title_or_description`, `missing_item_identifier`, `invalid_item_link`, `duplicate_item_guid`, `duplicate_item_link`, and `invalid_item_pub_date`;
- `missing_feed_id`, `missing_feed_title`, `missing_feed_updated`, `invalid_feed_updated`, and `invalid_feed_author`;
- `missing_entry_id`, `missing_entry_title`, `missing_entry_updated`, `invalid_entry_updated`, `missing_entry_author`, and `invalid_entry_author`; and
- `invalid_entry_alternate_link`, `missing_entry_content_or_alternate_link`, `duplicate_entry_id`, and `duplicate_entry_alternate_link`.

DTD and entity declarations are refused before XML parsing. Files with contact-email fields or authenticated, tokenized, or private access markers are also refused. The report identifies the feed type and contains finding codes, counts, and stable entry numbers only. It does not include source feed values, make network requests, inspect an account or CMS, import, subscribe, or modify the input.

`missing_item_identifier`, repeated RSS item links, repeated Atom entry IDs, and repeated Atom alternate links are review warnings. RSS permits an item without a GUID or link when it has a title or description, and RFC 4287 allows repeated Atom IDs to represent revisions of the same entry. These warnings identify reader-facing ambiguity; they are not described as conformance failures.

Static XML checks cannot establish a live URL's availability, HTTP status or headers, MIME type, redirects, cache state, ownership, publication state, extension semantics, content accuracy, reader behavior, or platform policy. The supported rules are not an exhaustive implementation of RSS, Atom, XML, URI, or IRI processing. The report does not guarantee HTTP behavior, MIME handling, or reader acceptance, publication, availability, traffic, or sales.

## Fixed-price scopes

| Tier | File limit | Delivery |
| --- | --- | --- |
| **USD 25 Report** | One public RSS 2.0 or Atom 1.0 snapshot, up to 250 entries and 2 MB | Supported value-free findings report; no file changes. |
| **USD 75 Correct** | One eligible file, up to 2,500 entries and 5 MB | Report, one corrected XML file with agreed deterministic corrections, change log, and second report. Replacement values must be supplied by the requester. |
| **USD 150 Full** | One eligible file, up to 10,000 entries and 10 MB | Correct delivery, supported-findings review, and one in-scope revision. |

Open a [fixed-price RSS and Atom feed request](https://github.com/tevinch/data-shape-kit/issues/new?template=rss-atom-feed-preflight-request.yml) with the tier, format, a synthetic or already-public excerpt, entry count, size, deadline, and acceptance criteria.

No feed reader, CMS, hosting, or server access, account login, live URL retrieval, import, subscription, publication, deployment, upload, content review, payment processing, infrastructure change, or security work is included. Scope, delivery, authorization, supplied correction values, and a private file-transfer method are confirmed before any eligible file is shared.
