# CSV Batch Preflight Checklist

Last verified: 2026-09-08

Use this checklist before combining ordinary CSV exports. The preflight is an offline structural check: it does not copy values into the report, change inputs, or connect to the system that produced them.

## Prepare a safe batch

- Place the CSV files to inspect directly in one directory. Subdirectories are ignored.
- Confirm the files are UTF-8 CSV and identify the exact expected header order.
- Define the deterministic combine order before work begins.
- Keep regulated, confidential, personal, financial, medical, education, identity, credential, and production data outside this service.
- Use a synthetic or fully redacted sample in a public request. Confirm a private transfer method before sharing eligible real files.

## Run the local report

Install the immutable public version:

```bash
python -m pip install "data-shape-kit @ https://github.com/tevinch/data-shape-kit/archive/refs/tags/v0.11.0.tar.gz"
```

Run the preflight:

```bash
data-shape-kit --batch-preflight exports/ batch-report.md
```

The report uses stable file numbers based on a case-insensitive filename sort. It never publishes file names, headers, or source cell values. It checks:

- `missing_header` for an empty file;
- `invalid_utf8` for a file that cannot be decoded safely;
- `blank_header` and `duplicate_header` for ambiguous schemas;
- `schema_mismatch` when a structurally valid schema differs from the first valid file; and
- `malformed_row` when a data row has a different column count from its header.

An exit status of 0 means no findings from the supported checks. An exit status of 1 means findings were written. An exit status of 2 means the directory could not be read safely. Passing does not establish semantic correctness, type consistency, record uniqueness, or suitability for any downstream system.

## Fixed-price scopes

| Tier | Batch limit | Delivery |
| --- | --- | --- |
| **USD 25 Report** | Up to 30 files, 50,000 rows, and 25 MB | Value-free preflight report; no file changes. |
| **USD 75 Combine** | Up to 100 files, 250,000 rows, and 100 MB | Report, one combined CSV after a passing preflight, row-count reconciliation, and change log. |
| **USD 150 Full** | Up to 500 files, 1,000,000 rows, and 500 MB | Combine delivery, reusable local command, and one in-scope revision. |

Open a [fixed-price CSV batch request](https://github.com/tevinch/data-shape-kit/issues/new?template=csv-batch-preflight-request.yml) with the tier, expected headers and order, a synthetic or fully redacted sample, total size and rows, deadline, and acceptance criteria.

No combine begins until the preflight passes and the deterministic order is agreed. No email, cloud-drive, SAP, or production-system access, account login, API integration, upload, payment processing, infrastructure change, or security work is included.
