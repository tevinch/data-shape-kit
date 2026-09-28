# Table state after a data refresh

A table's selected positions and pending cell edits can outlive the data they refer to. If a keyed Streamlit table receives an inserted or reordered row, a later action can target a different ticket. These examples give each served snapshot a revision, then either reset table state or restore a selected ticket by its stable ID.

| Example | Refresh behavior |
| --- | --- |
| [app.py](app.py) | Clears selection and unsaved note edits. Saved notes remain. |
| [selection_by_id.py](selection_by_id.py) | Keeps the selected ticket through insertions, reordering and value updates while its ID remains visible. Includes closing, filtering and removal; no note editor. |

Both keep selection on an unchanged rerun. The reset example also keeps its unsaved note draft on an unchanged rerun. These are application patterns for [Streamlit issue 17026](https://github.com/streamlit/streamlit/issues/17026).

Download the [complete example](../../downloads/data-revision-grid-v0.2.0.zip), or use the files in this folder.

**Reporter feedback — 23 September 2026:** The original reporter [confirmed that resetting state avoids the wrong-row selection in their example](https://github.com/streamlit/streamlit/issues/17026#issuecomment-5795047669). They still want application-supplied stable row IDs so selection can survive a refresh, and raised an explicit update/apply step as a possible improvement. The confirmation covers the reset workaround, not the editor checks or the new ID-preserving example. The latter was added on 28 September and has local test coverage below; there is no reporter adoption confirmation yet.

## Run

Use Python 3.12 in a fresh virtual environment:

```sh
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m streamlit run app.py
```

The app contains synthetic tickets in session memory. It does not connect to a database. Choose a ticket and close it, or edit a note and save it. Use the refresh controls to insert a row, reverse the order, or update a source value. Closing or saving also creates a new data revision, so it clears the other table's unsaved state too.

To run the ID-preserving selection example instead:

```sh
python -m streamlit run selection_by_id.py
```

Select TICK-102, insert a ticket, then close the selected ticket without selecting it again. TICK-102 stays highlighted and becomes closed. Reverse the rows or change the source note to try further refreshes. Hiding or removing the selected ticket clears selection; showing it again does not silently reselect it.

## Reset table state

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

## Preserve selection by record ID

Streamlit 1.64.0 supports [`selection_default`](https://docs.streamlit.io/develop/api-reference/data/st.dataframe) for a new table and programmatic selection through Session State. The selection API still returns row positions, so the application supplies the mapping to record IDs.

[selection_by_id.py](selection_by_id.py) performs four steps:

1. Build the current snapshot and find the previous selected ticket's position in it.
2. Render a new revision key with that position as `selection_default`, or an empty selection if the ticket is absent.
3. Immediately resolve the returned position against that exact snapshot and store its ticket ID. A user changing or clearing selection therefore replaces the previous ID.
4. Apply the requested operation by ID, advance the revision and rerun.

All data-changing controls in this example run **after** the table's event is resolved. If moving them into callbacks or adding background refreshes, preserve the association between each event and the snapshot that produced it. Do not interpret an old position against freshly loaded data.

IDs must be unique, non-null and stable for the lifetime of a record. A pandas index or row count is not automatically a suitable ID. `selection_default` seeds a new key only; changing the default with the same key does not remap an existing selection. The example uses `single-row` and `lazy=False`; Streamlit's lazy dataframes do not support selection. It has no editable grid and does not merge unsaved edits across refreshes.

This example makes changes only when a button is clicked. It does not add a background-update notification or freeze a live shared database. It also does not add a framework-level row-ID API, preserve browser scroll/sort state across new keys, or eliminate the possibility of clicking a row while it moves.

## Verification

```sh
python -m unittest discover -p "test*.py" -v
```

The six reset-example backend workflow tests cover inserted rows, repeated reordering, value updates, continued selection/closing, continued editing/saving, unchanged reruns, saved content and the editor's disabled-column, hidden-index and fixed-row settings. They run on Streamlit 1.64.0 and pandas 3.0.5.

Eight additional tests for `selection_by_id.py` cover continued closing after insertion and repeated reordering, a new user selection, unchanged reruns, source value updates, filtered and removed selection, empty-table recovery and explicit deselection. They also check the default row positions sent to the frontend. All 14 tests pass on the versions above. The insertion, repeated-reorder and source-update preservation expectations fail against the original reset example.

Streamlit 1.64.0's AppTest has no grid-selection/editor setter. The test-only adapter supplies simulated grid payloads to its private runner, so these tests are pinned to that release and do not constitute browser validation. The app itself uses public APIs.

The six-test reset suite with constant table keys fails four reset workflows while the unchanged-rerun and configuration controls pass. A separate reproduction of the issue's original example also closes TICK-101 after selecting TICK-102 and inserting a row.

Software-operated Chrome checks on macOS separately reproduced the original wrong-ticket close and a constant-key editor saving a TICK-102 draft onto TICK-103 after a four-row reversal. With revision keys, the browser checks completed these sequences:

- Select TICK-102, insert a row, attempt to close without selecting again: no ticket closes. Reselect TICK-102, rerun without changing data, close it: TICK-102 becomes closed.
- Edit a TICK-102 note and rerun unchanged: the draft remains. Reverse the rows and save: the old draft is gone and there are no changes to save.
- Enter a fresh TICK-102 note and save, then insert another row and reverse again: the saved note and closed status remain on TICK-102; other existing notes remain unchanged.
- Open the ticket-ID cell: its input is disabled. The visible editor has no index or add-row control.

Additional software-operated Chrome checks on 28 September used `selection_by_id.py` to select TICK-102, insert a row and close TICK-102 without reselecting; then select TICK-103, reverse and insert again, rerun unchanged and close TICK-103. The checkboxes and visible row highlights followed those IDs, and existing notes and other statuses remained intact. Further checks hid and restored selected TICK-102, removed selected TICK-104, and updated selected TICK-101's source note. Hiding/removal cleared selection; restoring visibility did not reselect. Clearing selection explicitly and then reversing/closing left the closed list unchanged.

These are local software-operated browser checks, not human manual validation or cross-browser coverage. The separate reporter confirmation above covers their wrong-row selection example only.

## License

MIT — see [LICENSE](LICENSE).

## Buy me a coffee, if this helped

If this saved you time, a coffee is welcome. No obligation — the example stays free, and useful feedback is welcome too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please match the asset and network exactly. Thank you! — Tevinch
