# Preserve CSV codes while keeping measurements numeric

A parameter code such as `00060` is text even when every row contains digits. Calling `astype(str)` after automatic CSV inference cannot recover zeros that have already been discarded. Reading the whole file as text also prevents ordinary arithmetic on measurement and count columns.

The [Samples identifier request](https://github.com/DOI-USGS/dataretrieval-python/issues/411) provides a concrete example: parameter codes, HUCs, FIPS codes and location identifiers need their original text, while measurements and counts need numeric inference. The following small pandas helper reads the header first, selects text columns, and then parses the complete CSV once with those dtypes.

## Copy the helper

Use Python 3.10 or newer and pandas. The example below was verified with Python 3.12 and pandas 2.2.3. Save this block as `csv_codes.py`:

```python
"""Shared CSV parsing that preserves significant zeros in codes and identifiers."""

from collections.abc import Collection
from io import StringIO

import pandas as pd
from pandas import DataFrame


def _is_code_column(name: str) -> bool:
    """Report whether a column name denotes a code or identifier.

    Such columns (HUCs, parameter codes, FIPS codes) have leading zeros that
    are significant and must be preserved as ``str``. A name qualifies if it
    ends with "code" or contains "identifier", "huc", or "fips".
    """
    lname = name.lower()
    return lname.endswith("code") or any(
        token in lname for token in ("identifier", "huc", "fips")
    )


def read_code_csv(text: str, *, infer_columns: Collection[str] = ()) -> DataFrame:
    """Read CSV text with code/identifier columns as strings.

    Read the header first to select string columns before numeric inference can
    discard leading zeros (``"00060"`` -> ``60``). Other columns retain pandas'
    inferred types, and the default missing-value handling is unchanged.
    ``infer_columns`` also retain inference when their names match a code or
    identifier, allowing a caller to distinguish counts from identifiers.
    """
    columns = pd.read_csv(StringIO(text), delimiter=",", nrows=0).columns
    str_cols = {
        col: str for col in columns if col not in infer_columns and _is_code_column(col)
    }
    return pd.read_csv(StringIO(text), delimiter=",", low_memory=False, dtype=str_cols)
```

Column matching is case-insensitive: a name ends with `code`, or contains `identifier`, `huc`, or `fips`. This is a naming convention, not a universal schema detector. Review the field names supplied by your data provider. Columns listed in `infer_columns` use normal pandas inference even if their names match that convention.

## Use it on a whole table

```python
from csv_codes import read_code_csv
import pandas as pd

csv_text = (
    "USGSpcode,Location_HUCEightDigitCode,stateFips,"
    "MonitoringLocationIdentifier,AlternateLocation_IdentifierCount,"
    "ResultMeasureValue,resultCount\n"
    "00060,07090002,01,00123,2,1.5,4\n"
    "00065,07090003,02,00456,0,,0\n"
)
df = read_code_csv(
    csv_text,
    infer_columns=("AlternateLocation_IdentifierCount",),
)

assert df["USGSpcode"].tolist() == ["00060", "00065"]
assert df["Location_HUCEightDigitCode"].tolist() == ["07090002", "07090003"]
assert df["stateFips"].tolist() == ["01", "02"]
assert df["MonitoringLocationIdentifier"].tolist() == ["00123", "00456"]
assert df["AlternateLocation_IdentifierCount"].sum() == 2
assert df["resultCount"].sum() == 4
assert df["ResultMeasureValue"].iloc[0] == 1.5
assert pd.isna(df["ResultMeasureValue"].iloc[1])
```

`AlternateLocation_IdentifierCount` is a real count field in the Samples data shape. Its name contains `Identifier`, so it must be exempted from the text convention. The default helper behavior remains available to callers that already depend on it.

## Missing values and limits

The helper retains pandas' default missing-value recognition. An empty code cell, or an identifier literally spelled `NA` or `NULL`, can become a missing value. If those spellings are literal identifiers in your application, use an explicit text-column import contract such as [Identifier Column](../examples/identifier-import) instead. Choose this policy before parsing; converting a missing value to text afterwards cannot recover the original spelling.

The helper accepts comma-separated text already in memory. It does not guess delimiters, recover spreadsheet formatting, reconstruct zeros, or fetch data. Other columns retain pandas inference, including its normal limits for very large numeric values. Date conversion and row sorting belong to the caller and are not performed here.

## Source and integration

The two-pass convention comes from the WQP parser in [dataretrieval-python at 50407c8](https://github.com/DOI-USGS/dataretrieval-python/blob/50407c8c10e77cfdf76655dd9240ecc78717c55d/dataretrieval/wqp.py). The reusable helper adds an explicit inference exception for count fields. Its source is available under the upstream [CC0 dedication](https://github.com/DOI-USGS/dataretrieval-python/blob/50407c8c10e77cfdf76655dd9240ecc78717c55d/LICENSE.md). This independent guide does not imply USGS endorsement.

The [proposed Samples integration](https://github.com/DOI-USGS/dataretrieval-python/pull/419) preserves request URLs, metadata, return tuples and date shaping. Its offline suite passed 1,142 tests with 98.93% coverage with branch measurement enabled; 12 live tests were deliberately excluded. Local checks also passed mypy, Ruff, all eight import contracts, xenon and complexipy. The wheel includes the shared module and was imported outside the source checkout. These results describe the proposed change on its tested base, not a released upstream version. The PR was open and awaiting maintainer review on September 10, 2026; the helper above can be reused independently.

## Buy me a coffee, if this helped


If this saved you a little time, you're welcome to buy me a coffee. Please don't feel obliged — the code stays free, and feedback with a small synthetic case is appreciated too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please match the asset and network exactly. Fees depend on your wallet or exchange. Thank you! — Tevinch
