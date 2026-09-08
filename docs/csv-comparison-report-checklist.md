# CSV Comparison Report Checklist

Last verified: 2026-09-08

Use this checklist to compare two ordinary catalog or inventory CSV exports locally. The comparison is exact and deterministic: it does not infer that similar headers or key values mean the same thing.

## Before comparing

1. Keep an unchanged copy of both source files.
2. Confirm that both files are UTF-8 CSV and that every row has the same number of columns as its header.
3. Choose one exact header whose non-empty values should identify records uniquely in both files.
4. Use a synthetic or fully redacted sample when discussing scope in a public issue.
5. Do not use this service for regulated, confidential, personal, financial, medical, education, identity, credential, or production data.

## Run the local report

Install the immutable public version:

```bash
python -m pip install "data-shape-kit @ https://github.com/tevinch/data-shape-kit/archive/refs/tags/v0.10.0.tar.gz"
```

Run the comparison with the previous file as the source and the current file after `--compare-to`:

```bash
data-shape-kit --compare-to current.csv --key "SKU" previous.csv comparison.md
```

The command reads both files and does not modify either input. It compares values under exact common headers. The report covers:

- added, removed, and reordered column counts;
- source row numbers with missing or duplicate keys;
- source row numbers present only in the previous or current file;
- old/new source row pairs whose common-column values changed; and
- the count of matched unchanged rows.

The report does not include source cell values, header names, key values, or file names. Row numbers are still metadata and should be handled carefully. Duplicate key values are ambiguous, so all their rows are reported and skipped during record comparison.

## Interpret the result

- `missing_key_old` and `missing_key_new` rows cannot be matched.
- `duplicate_key_old` and `duplicate_key_new` rows are ambiguous and are not matched.
- `only_old` and `only_new` identify unique keys found on one side only.
- `changed_record` pairs the old and new source row numbers for a unique key with at least one changed value under an exact common header.
- Column changes are warnings for review. A changed order or name does not by itself prove a business-meaning change.

An exit status of 0 means the supported comparison found no differences. An exit status of 1 means the report contains findings. An exit status of 2 means the command could not safely compare the files, for example because the exact key header was absent or ambiguous.

## Fixed-price scopes

| Tier | File limit | Delivery |
| --- | --- | --- |
| **USD 25 Report** | Up to 500 rows per file, 10 MB combined | Exact key, all exact common columns, value-free report, no file changes. |
| **USD 75 Select** | Up to 5,000 rows per file, 20 MB combined | Exact key, up to 10 selected exact common columns, reusable command, and one report revision. |
| **USD 150 Full** | Up to 50,000 rows per file, 50 MB combined | Exact key, all exact common columns, an agreed header-pairing plan, reusable command, and one revision. |

Open a [fixed-price CSV comparison report request](https://github.com/tevinch/data-shape-kit/issues/new?template=csv-comparison-report-request.yml) with the tier, key, comparison columns, deadline, acceptance criteria, and only a synthetic or fully redacted sample. No account or shared-sheet access, cloud integration, production-system access, import, upload, payment processing, infrastructure change, or security work is included.

The public request must contain no regulated, confidential, personal, financial, medical, education, identity, credential, or production data. Scope, delivery, and a private file-transfer method are confirmed before any real file is shared.
