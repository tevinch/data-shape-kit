# Decimal paste example for Streamlit

Keep spreadsheet numbers as text until you explicitly choose their decimal and grouping marks. This small example accepts `23,4` as `Decimal('23.4')`, preserves the original string beside the result, and rejects malformed grouping instead of silently removing punctuation.

Free under the [MIT license](LICENSE). The copyable [Python helper](decimal_text.py) uses only the standard library. The optional [Streamlit app](streamlit_app.py) uses a native `TextColumn` for input and reports valid, invalid and empty rows.

## Use the helper

Copy `decimal_text.py` and `LICENSE` beside your Python code. Python 3.11 or newer is recommended.

```python
from decimal_text import parse_decimal_text

value = parse_decimal_text('23,4', decimal_mark=',')
print(value)  # 23.4 (a Decimal, not a float)

value = parse_decimal_text('1.234,50', decimal_mark=',', group_mark='.')
print(value)  # 1234.50

value = parse_decimal_text('1,234.50', decimal_mark='.', group_mark=',')
print(value)  # 1234.50
```

Always choose the format from your source. `1,234` means `1.234` with a comma decimal mark, but `1234` with a dot decimal mark and comma grouping. The helper does not guess which you intended.

## Run the local example

Download this repository, then run these commands from this directory:

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-demo.txt
python -m streamlit run streamlit_app.py --server.address 127.0.0.1 --server.headless true --browser.gatherUsageStats false
```

On Windows, activate with `.venv\Scripts\activate` instead. Open the local URL printed in the terminal. The demo dependency is pinned to Streamlit 1.63.0; installing it requires internet access.

1. Select **Comma (,)** as the decimal mark and **Dot (.)** as the grouping mark.
2. Click the first cell in **Raw value** and paste this single column:

```text
23,4
1.234,50
12.34,5
0012,00
```

3. Finish editing the cell, then click **Convert values**. The report shows three valid rows and one invalid row. `12.34,5` is rejected because its final integer group has only two digits. `0012,00` remains visible as the raw input; its decimal result is `12.00`.

Conversion results are displayed as strings so JSON does not discard precision or trailing decimal zeros. The underlying helper returns `Decimal` objects. Editing the table or changing a format clears the prior report; click **Convert values** again to refresh it.

This is a local Python web app: pasted values travel from your browser to the Python server running on your computer. It is not a browser-only converter. The example itself does not save values or send them to another service. If you deploy it to a remote server, that server will receive the input.

## Accepted number syntax

- Decimal mark: `.` or `,`, explicitly required. A decimal fraction is optional, but digits are required on both sides when the mark is present.
- Grouping mark: optional; one of `.`, `,`, ordinary space, non-breaking space (`U+00A0`) or narrow non-breaking space (`U+202F`). It must differ from the decimal mark.
- Grouped integers: one to three digits in the first group, then exactly three in every later group. Ungrouped integers are also accepted.
- Digits: ASCII `0`–`9`; one optional leading `+` or `-`. Ordinary spaces and the two supported non-breaking spaces may surround the whole number.
- Maximum input length: 256 Python string characters, including surrounding spaces. The helper rejects longer input before trimming it.

Currency symbols, percent signs, exponents, underscores, Unicode digits, tabs, newlines, non-finite values, trailing decimal marks (`1,`) and omitted integer digits (`,5`) are rejected. This deliberately small grammar does not cover every locale. It raises `TypeError` for non-string input and `ValueError` for invalid options or number syntax; error messages omit the input value. The demo reports blank cells separately as empty.

The helper constructs `Decimal` directly from text without going through a binary float or changing the global decimal context. Later arithmetic follows the decimal context in your own code. Leading integer zeros are retained in the raw string, not in the Decimal representation.

## Scope and verification

This provides an alternative input workflow for the decimal-comma problem discussed in [Streamlit issue #7866](https://github.com/streamlit/streamlit/issues/7866). It does not patch Streamlit's numeric-column paste behavior or recover punctuation already lost in an earlier conversion. Feed the original clipboard text into a text column from the start.

Streamlit documents [TextColumn](https://docs.streamlit.io/develop/api-reference/data/st.column_config/st.column_config.textcolumn) as its text input column and describes [NumberColumn formatting](https://docs.streamlit.io/develop/api-reference/data/st.column_config/st.column_config.numbercolumn) as display formatting. The related [CSV delimiter PR #9197](https://github.com/streamlit/streamlit/pull/9197) concerns downloads, rather than this input path.

Run the helper tests from this directory:

```sh
python -m unittest -v test_decimal_text.py
```

The 12 tests cover exact decimals, separator choices, whitespace grouping, malformed input, ambiguous punctuation, length limits and unchanged decimal context. The local demo was checked in Chrome with Streamlit 1.63.0 for multi-row text paste, explicit grouping and malformed-number reports.

For quoted, tab-separated clipboard text in JavaScript, see [Clipboard Table](../../javascript/clipboard-table). This Python example is separate and is not included in the older JavaScript download archives.

## Buy me a coffee, if this helped

If this saved you a little time, you're welcome to buy me a coffee. Please don't feel obliged — feedback or sharing the example is appreciated too.

- **USDC on Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC on Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please match the asset and network exactly. Fees depend on your wallet or exchange. Thank you! — Tevinch
