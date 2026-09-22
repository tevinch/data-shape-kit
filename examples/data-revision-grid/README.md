# Table state after a data refresh

A table's selected positions and pending cell edits can outlive the data they refer to. If a keyed Streamlit table receives an inserted or reordered row, a later action can target a different ticket. This example scopes both table keys to a data revision, so a refreshed snapshot starts with fresh selection and edit state.

**Refreshes discard unsaved notes and clear selection.** Saved notes remain. A rerun that does not change data keeps the existing selection and draft. This is the reset behavior discussed in [Streamlit issue 17026](https://github.com/streamlit/streamlit/issues/17026); it does not preserve selection by primary key across a refresh.

Download the [complete example](../../downloads/data-revision-grid-v0.1.0.zip), or use the files in this folder.

## Run

Use Python 3.12 in a fresh virtual environment:

```sh
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m streamlit run app.py
```

The app contains synthetic tickets in session memory. It does not connect to a database. Choose a ticket and close it, or edit a note and save it. Use the refresh controls to insert a row, reverse the order, or update a source value. Closing or saving also creates a new data revision, so it clears the other table's unsaved state too.

## Apply the pattern

```python
# Load or replace these together. Keep revision stable on an ordinary rerun.
snapshot, revision = load_current_snapshot()

selection = st.dataframe(
    snapshot,
    key=f"queue:{revision}",
    on_select="rerun",
    selection_mode="single-row",
)
edited = st.data_editor(
    snapshot,
    key=f"notes:{revision}",
    num_rows="fixed",
    disabled=["ticket", "status"],
    hide_index=True,
)
```

`load_current_snapshot()` above stands for your application's data loading; it is not a Streamlit API. See [app.py](app.py) for a complete in-memory implementation.

Advance the revision whenever the served data changes: insertion, deletion, reordering, filtering or value updates. A backend snapshot version is suitable if it covers all those changes. Row count alone misses reorders and value changes. A random value on every rerun discards valid interaction state unnecessarily. Separate datasets need separate key prefixes.

Resolve selection positions against the exact snapshot passed to `st.dataframe`. Streamlit's [selection documentation](https://docs.streamlit.io/develop/api-reference/data/st.dataframe) defines these as positions in the original data, including when the browser sorts the display. For fixed rows, the example maps edited note values back to IDs from the served snapshot. The ticket and status columns remain disabled; the index is hidden.

This pattern does not implement cross-session conflict detection, database writes or authorization. Applications that save to a shared backend still need their normal version checks and validation. It also does not settle the framework's choice of identity behavior or address dynamic-row editing.

## Verification

```sh
python test_app.py
```

The six backend workflow tests cover inserted rows, repeated reordering, value updates, continued selection/closing, continued editing/saving, unchanged reruns, saved content and the editor's disabled-column, hidden-index and fixed-row settings. They run on Streamlit 1.64.0 and pandas 3.0.5.

Streamlit 1.64.0's AppTest has no grid-selection/editor setter. The test-only adapter supplies simulated grid payloads to its private runner, so these tests are pinned to that release and do not constitute browser validation. The app itself uses public APIs.

The same suite with constant table keys fails four reset workflows while the unchanged-rerun and configuration controls pass. A separate reproduction of the issue's original example also closes TICK-101 after selecting TICK-102 and inserting a row.

Software-operated Chrome checks on macOS separately reproduced the original wrong-ticket close and a constant-key editor saving a TICK-102 draft onto TICK-103 after a four-row reversal. With revision keys, the browser checks completed these sequences:

- Select TICK-102, insert a row, attempt to close without selecting again: no ticket closes. Reselect TICK-102, rerun without changing data, close it: TICK-102 becomes closed.
- Edit a TICK-102 note and rerun unchanged: the draft remains. Reverse the rows and save: the old draft is gone and there are no changes to save.
- Enter a fresh TICK-102 note and save, then insert another row and reverse again: the saved note and closed status remain on TICK-102; other existing notes remain unchanged.
- Open the ticket-ID cell: its input is disabled. The visible editor has no index or add-row control.

These are local software-operated browser checks, not human manual validation, cross-browser coverage or confirmation from the original reporter.

## License

MIT — see [LICENSE](LICENSE).

## Buy me a coffee, if this helped

If this saved you time, a coffee is welcome. No obligation — the example stays free, and useful feedback is welcome too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please match the asset and network exactly. Thank you! — Tevinch
