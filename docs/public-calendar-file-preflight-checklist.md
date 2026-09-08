# Public Event Calendar File Preflight Checklist

Last verified: 2026-09-08

Use this checklist to review one iCalendar snapshot containing public events before an authorized publisher handles import or distribution. This project is independent and is not endorsed by Google, Microsoft, WordPress, or any calendar provider. It does not access a website, calendar account, content-management system, hosting account, or server.

## Current official guidance

RFC 5545 defines iCalendar content lines, line folding, calendar components, event properties, dates, date-times, durations, and recurrence. Google documents file-import troubleshooting separately from the file format. Microsoft distinguishes importing a fixed copy from subscribing to a calendar that later refreshes.

- [RFC 5545: Internet Calendaring and Scheduling Core Object Specification](https://www.rfc-editor.org/rfc/rfc5545.html)
- [Google Calendar import troubleshooting](https://support.google.com/calendar/answer/45654?hl=en-uk&ref_topic=10510448)
- [Microsoft: import or subscribe to a calendar](https://support.microsoft.com/en-us/outlook/import-or-subscribe-to-a-calendar-in-outlook-com-or-outlook-on-the-web)

Specifications and platform behavior can change. Recheck current provider guidance and perform an authorized live import separately before distribution.

## Prepare an eligible file

- Use one UTF-8 `.ics` file no larger than 10 MB.
- Use CRLF line endings and fold physical content lines longer than 75 octets.
- Include one `VCALENDAR` with `PRODID`, `VERSION:2.0`, and at least one `VEVENT`.
- Give every event one non-empty `UID`, one UTC `DTSTAMP`, and one valid `DTSTART`.
- Use either `DTEND` or `DURATION`, not both, and keep a comparable end after the start.
- Use `METHOD:PUBLISH` when a method is present and `CLASS:PUBLIC` when a class is present.
- Use an invented excerpt or content that is already public in a public issue.
- Real work accepts a public event calendar only, supplied by its owner or controller.
- Remove all `ATTENDEE`, `ORGANIZER`, and `CONTACT` properties. Meeting requests and `CLASS:PRIVATE` or `CLASS:CONFIDENTIAL` content are refused rather than reported.
- Do not provide personal schedules, private school or workplace calendars, booking records, invitations, tokenized feeds, regulated data, credentials, or unpublished event details.

## Run the local report

Install the immutable public version:

```bash
python -m pip install "data-shape-kit @ https://github.com/tevinch/data-shape-kit/archive/refs/tags/v0.16.0.tar.gz"
```

Run the preflight:

```bash
data-shape-kit --calendar-preflight events.ics preflight.md
```

The report covers supported static findings, including:

- `non_crlf_line_ending`, `long_content_line`, `invalid_fold`, and `invalid_content_line`;
- `missing_calendar`, `multiple_calendar`, `invalid_component_nesting`, `mismatched_component_end`, and `unclosed_component`;
- `missing_prodid`, `missing_version`, `invalid_version`, and `empty_calendar`;
- missing or repeated `UID`, `DTSTAMP`, and `DTSTART`; empty `UID`; invalid `DTSTAMP`, `DTSTART`, or `DTEND`; and repeated `DTEND` or `DURATION`;
- `dtend_duration_conflict`, `mismatched_date_value_type`, `nonpositive_event_span`, and `duplicate_event_uid`.

`duplicate_event_uid` is a review warning because a public snapshot can deliberately carry multiple representations of one event. Line-length findings use physical line numbers; other locations use the first physical line of each unfolded content line.

The report contains finding codes, counts, and line numbers only; it does not include source calendar values. It does not import or subscribe, make network requests, inspect an account, send invitations, expand recurrence rules, or modify the input.

This preflight does not validate duration or recurrence syntax, evaluate complete recurrence or time-zone semantics, inspect MIME or HTTP behavior, test hosted-feed availability, access calendar-account state, perform a live import, refresh a subscription, or predict provider-specific interpretation. It does not guarantee platform import, interoperability, availability, traffic, or sales.

## Fixed-price scopes

| Tier | File limit | Delivery |
| --- | --- | --- |
| **USD 25 Report** | One public event calendar file, up to 250 events and 2 MB | Supported value-free findings report; no file changes. |
| **USD 75 Correct** | One eligible file, up to 2,500 events and 5 MB | Report, one corrected iCalendar file with agreed deterministic corrections, change log, and second report. |
| **USD 150 Full** | One eligible file, up to 10,000 events and 10 MB | Correct delivery, supported-findings review, and one in-scope revision. |

Open a [fixed-price public event calendar file request](https://github.com/tevinch/data-shape-kit/issues/new?template=public-calendar-file-preflight-request.yml) with the tier, a synthetic or public excerpt, event count, size, deadline, and acceptance criteria.

No calendar account, Google Calendar, Outlook, WordPress, hosting, or server access, live URL retrieval, import, subscription, invitation sending, recurrence expansion, deployment, upload, payment processing, infrastructure change, or security work is included. Scope, delivery, authorization, and a private file-transfer method are confirmed before any eligible file is shared.
