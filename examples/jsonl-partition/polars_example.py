"""Run the JSONL partitioner on a repeatable synthetic Polars example."""

import io
import json
from dataclasses import asdict

import polars as pl

from jsonl_partition import partition_jsonl


def main() -> None:
    source_bytes = b'{"a": 1,"b": 3}\nx\n{"a": 4,"b": 2}\n'
    accepted = io.BytesIO()
    rejected = io.BytesIO()
    issues = io.StringIO()

    stats = partition_jsonl(
        io.BytesIO(source_bytes), accepted, rejected, issues
    )
    accepted_bytes = accepted.getvalue()
    schema = {"a": pl.Int64, "b": pl.Int64}
    eager = pl.read_ndjson(io.BytesIO(accepted_bytes), schema=schema)
    lazy = pl.scan_ndjson(io.BytesIO(accepted_bytes), schema=schema).collect()

    result = {
        "polars_version": pl.__version__,
        "source_lines": 3,
        "stats": asdict(stats),
        "issues": [json.loads(line) for line in issues.getvalue().splitlines()],
        "rejected_text": rejected.getvalue().decode("utf-8"),
        "eager_rows": eager.to_dicts(),
        "lazy_rows": lazy.to_dicts(),
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
