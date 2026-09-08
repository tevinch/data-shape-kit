# Podcast RSS Preflight Checklist

Last verified: 2026-09-08

Use this checklist to review one public podcast RSS snapshot before an authorized show owner handles platform submission. This project is independent and is not endorsed by Apple, Spotify, or WordPress. It does not access a platform, website, server, hosting account, or content-management system.

## Current official guidance

Apple's current documentation requires RSS 2.0, required tags, at least one episode, and show artwork. It says every episode needs a unique `enclosure` with URL, length, and type components plus a stable GUID. It also requires case-sensitive tags and RFC 2822 dates when dates are supplied. The RSS Advisory Board specification defines an `rss` root with version `2.0`, one `channel`, and required channel `title`, `link`, and `description` elements.

- [Apple podcast RSS feed requirements](https://podcasters.apple.com/support/823-podcast-requirements)
- [RSS 2.0 specification](https://www.rssboard.org/rss-specification)

Requirements and platform behavior change. Recheck the official pages before submission.

## Prepare an eligible file

- Use one UTF-8 XML snapshot no larger than 10 MB.
- Use RSS 2.0 with exactly one channel and at least one episode.
- Include channel title, HTTP(S) link, description, and iTunes show artwork.
- Include an episode title, one HTTP(S) enclosure with URL/length/type components, and one stable GUID for every episode.
- Use an invented excerpt or content that is already public in a public issue.
- Real work accepts a public podcast RSS snapshot only, supplied by its owner or controller. Exclude private, paid-subscriber, password-protected, tokenized, personal, regulated, confidential, credential-bearing, or unpublished feeds.

## Run the local report

Install the immutable public version:

```bash
python -m pip install "data-shape-kit @ https://github.com/tevinch/data-shape-kit/archive/refs/tags/v0.16.0.tar.gz"
```

Run the preflight:

```bash
data-shape-kit --podcast-feed-preflight feed.xml preflight.md
```

The report covers supported static findings, including:

- `invalid_root`, `invalid_version`, `missing_channel`, and `multiple_channel`;
- `missing_channel_title`, `missing_channel_link`, `invalid_channel_link`, and `missing_channel_description`;
- `missing_artwork`, `invalid_artwork_url`, `empty_feed`, and `missing_episode_title`;
- `missing_enclosure`, `multiple_enclosure`, enclosure URL/length/type findings, and `duplicate_enclosure_url`;
- `missing_guid`, `duplicate_guid`, and `invalid_pub_date`.

DTD and entity declarations are refused before XML parsing. The report contains finding codes, counts, and episode numbers only. It does not include source feed values, make network requests, inspect an account, download media, or modify the input.

Static syntax cannot establish a live feed's availability, HTTP or HEAD behavior, byte-range support, content type, redirects, cache state, enclosure media availability or format, artwork dimensions or type, platform-account state, ownership, content policy, review, listing, or playback. It does not guarantee platform acceptance, listing, availability, playback, traffic, or sales.

## Fixed-price scopes

| Tier | File limit | Delivery |
| --- | --- | --- |
| **USD 25 Report** | One public podcast RSS snapshot, up to 100 episodes and 2 MB | Supported value-free findings report; no file changes. |
| **USD 75 Correct** | One eligible file, up to 500 episodes and 5 MB | Report, one corrected XML file with agreed deterministic corrections, change log, and second report. |
| **USD 150 Full** | One eligible file, up to 2,000 episodes and 10 MB | Correct delivery, supported-findings review, and one in-scope revision. |

Open a [fixed-price podcast RSS request](https://github.com/tevinch/data-shape-kit/issues/new?template=podcast-rss-preflight-request.yml) with the tier, a synthetic or public excerpt, episode count, size, deadline, and acceptance criteria.

No Apple Podcasts, Spotify, WordPress, hosting, or server access, account login, live URL retrieval, media download, artwork inspection, deployment, upload, submission, content review, payment processing, infrastructure change, or security work is included. Scope, delivery, authorization, and a private file-transfer method are confirmed before any eligible file is shared.
