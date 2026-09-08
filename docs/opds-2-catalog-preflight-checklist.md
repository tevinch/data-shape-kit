# OPDS 2.0 Catalog Preflight Checklist

Last verified: 2026-09-09

Use this checklist to review one already-public, authentication-free OPDS 2.0 JSON snapshot before its owner handles reader testing. This project is independent and is not endorsed by the OPDS community, Readium Foundation, EDRLab, any catalog publisher, or any reader vendor. It does not access a reader, catalog server, hosting account, or publishing account.

## Current primary references

The living OPDS 2.0 specification defines feed, navigation, group, facet, and publication structures and the relationships used for acquisition links. Its official JSON Schema resources provide broader machine-readable validation for feeds and publications. Use the official JSON Schema separately when complete schema coverage is needed; this local report deliberately focuses on a smaller, privacy-preserving preflight surface.

- [OPDS 2.0 specification](https://specs.opds.io/opds-2.0)
- [Official feed JSON Schema](https://specs.opds.io/schema/feed.schema.json)
- [Official publication JSON Schema](https://specs.opds.io/schema/publication.schema.json)

The specification, schemas, and reader behavior can change. Recheck the primary references before publication.

## Prepare an eligible file

- Use one uncompressed UTF-8 JSON snapshot no larger than 10 MB.
- Supply a feed object with a metadata title, a valid self link, and at least one navigation, publications, or groups collection.
- Give navigation links titles. Give each group a metadata title and exactly one navigation or publications collection. Give each facet a metadata title and preferably at least two links.
- Give each publication metadata with a title, at least one public `download`, `preview`, historic open-access, or historic sample link, and a JPEG, AVIF, WebP, JPEG XL, PNG, or GIF image.
- Use an invented excerpt or content that is already public. Real work accepts only a public, authentication-free OPDS 2.0 snapshot supplied by its owner or controller.
- Remove contact-email, authentication, credential, token, session, DRM, price, private, and restricted fields. Remove user information and sensitive query parameters from URLs.
- Paid, borrowed, subscribed, authenticated, DRM-protected, tokenized, personalized, private, restricted, confidential, personal, identity, credential-bearing, unpublished, and production catalogs are outside scope.

## Run the local report

Install the immutable public version:

```bash
python -m pip install "data-shape-kit @ https://github.com/tevinch/data-shape-kit/archive/refs/tags/v0.18.0.tar.gz"
```

Run the preflight:

```bash
data-shape-kit --opds-preflight catalog.json preflight.md
```

The report covers supported findings, including:

- `invalid_json_syntax`, `invalid_root`, `duplicate_json_member`, and `blank_metadata_value`;
- `missing_feed_title`, `missing_feed_self_link`, and `missing_catalog_collection`;
- `invalid_link_object`, `missing_link_href`, `invalid_link_href`, and `invalid_link_rel`;
- `missing_navigation_title`, `missing_group_title`, `invalid_group_collections`, `missing_facet_title`, and `sparse_facet_links`; and
- `missing_publication_metadata`, `missing_publication_title`, `missing_public_acquisition`, `missing_publication_images`, and `missing_supported_publication_image`.

The report contains only the catalog type, collection and publication counts, finding codes, severity, counts, and stable locations. It does not include source catalog values. It does not make network requests, inspect an account, authenticate, download publications, or modify the input.

Static JSON checks cannot establish a live URL's availability, HTTP status or headers, MIME type, redirects, media validity, ownership, publication state, complete schema conformance, reader behavior, or platform policy. The report does not guarantee HTTP behavior, MIME handling, or reader acceptance, availability, traffic, or sales.

## Fixed-price scopes

| Tier | File limit | Delivery |
| --- | --- | --- |
| **USD 25 Report** | One public, authentication-free OPDS 2.0 snapshot, up to 250 publications and 2 MB | Supported value-free findings report; no file changes. |
| **USD 75 Correct** | One eligible file, up to 2,500 publications and 5 MB | Report, one corrected JSON file using requester-supplied replacement values, change log, and second report. |
| **USD 150 Full** | One eligible file, up to 10,000 publications and 10 MB | Correct delivery, supported-findings review, and one in-scope revision. |

Open a [fixed-price OPDS 2.0 catalog request](https://github.com/tevinch/data-shape-kit/issues/new?template=opds-2-catalog-preflight-request.yml) with the tier, a synthetic or already-public excerpt, acquisition mode, publication count, size, deadline, and acceptance criteria.

No reader, catalog server, hosting, or account access, login, live URL retrieval, publication download, import, subscription, publication, deployment, upload, payment processing, infrastructure change, or security work is included. Scope, delivery, authorization, supplied correction values, and a private file-transfer method are confirmed before any eligible file is shared.
