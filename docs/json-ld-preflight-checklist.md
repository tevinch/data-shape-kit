# JSON-LD Preflight Checklist

Last verified: 2026-09-08

Use this checklist to review JSON-LD embedded in one public HTML snapshot before an authorized site owner handles a release. This project is independent and is not endorsed by Google, Schema.org, WordPress, or any SEO-tool provider. It does not access a website, account, server, content-management system, Search Console, or hosted validator.

## Current official guidance

JSON-LD 1.1 is a W3C Recommendation and defines JSON-LD documents, node objects, graph objects, contexts, identifiers, types, and embedding in HTML `script` elements. Google supports JSON-LD and generally recommends it for Search structured data, but its documentation says feature-specific required properties and content guidelines still apply. Valid markup does not guarantee a rich result.

- [W3C JSON-LD 1.1 Recommendation](https://www.w3.org/TR/json-ld11/)
- [Google structured data introduction](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)
- [Google general structured data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)

Specifications, vocabularies, feature requirements, and search behavior change. Recheck the relevant official pages and use the appropriate hosted validator before release.

## Prepare an eligible file

- Use one UTF-8 HTML snapshot no larger than 10 MB.
- Embed each block in a `script` whose media type is `application/ld+json`.
- Keep every block valid JSON with an object or array-of-objects top level.
- Use context, type, identifier, and graph structures that match the W3C shapes relevant to the page.
- Use an invented excerpt or content that is already public in a public issue.
- Real work accepts a public HTML snapshot only, supplied by the page owner or controller. Exclude private, staging, password-protected, personalized, regulated, confidential, personal, identity, credential-bearing, or unpublished pages.

## Run the local report

Install the immutable public version:

```bash
python -m pip install "data-shape-kit @ https://github.com/tevinch/data-shape-kit/archive/refs/tags/v0.16.0.tar.gz"
```

Run the preflight:

```bash
data-shape-kit --json-ld-preflight page.html preflight.md
```

The report covers supported static findings, including:

- `missing_json_ld_script`, `empty_json_ld_script`, `invalid_json_syntax`, `invalid_top_level`, and `empty_top_level`;
- `duplicate_json_member`, `invalid_context_shape`, and `missing_context`;
- `invalid_type_shape`, `missing_type`, `invalid_id_shape`, and `invalid_graph_shape`;
- `duplicate_json_ld_block` and `repeated_id`.

`repeated_id` is a review-only warning: linked-data graphs can deliberately reuse identifiers to describe or reference the same node. Completely repeated blocks are reported separately, and repeated identifiers inside those blocks are suppressed to avoid redundant findings. `missing_context` and `missing_type` are also review prompts rather than a claim that every possible JSON-LD processor will reject the document.

Locations are stable script numbers or script.object numbers. The report does not include source JSON-LD values. It does not make network requests, inspect an account, or execute scripts. It does not resolve remote contexts, compare visible page content, or modify the input.

This preflight does not validate schema.org vocabulary, Google feature-specific required or recommended properties, visible-content agreement, factual accuracy, content quality, spam policy, dynamic DOM output, live crawlability, or deployed behavior. It does not guarantee rich-result eligibility, appearance, ranking, traffic, or sales.

## Fixed-price scopes

| Tier | File limit | Delivery |
| --- | --- | --- |
| **USD 25 Report** | One public HTML snapshot, up to 25 JSON-LD scripts and 2 MB | Supported value-free findings report; no file changes. |
| **USD 75 Correct** | One eligible file, up to 100 JSON-LD scripts and 5 MB | Report, one corrected HTML snapshot with agreed deterministic JSON-LD corrections, change log, and second report. |
| **USD 150 Full** | One eligible file, up to 250 JSON-LD scripts and 10 MB | Correct delivery, supported-findings review, and one in-scope revision. |

Open a [fixed-price JSON-LD request](https://github.com/tevinch/data-shape-kit/issues/new?template=json-ld-preflight-request.yml) with the tier, a synthetic or public excerpt, script count, size, deadline, and acceptance criteria.

No Search Console, WordPress, SEO-tool, hosting, or server access, account login, live URL retrieval, script execution, remote-context retrieval, deployment, upload, validation submission, payment processing, infrastructure change, or security work is included. Scope, delivery, authorization, and a private file-transfer method are confirmed before any eligible file is shared.
