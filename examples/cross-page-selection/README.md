# Cross-page selection

A free MIT module and runnable example for selecting all eligible results of a paginated query, then excluding individual rows. Selecting all does not require downloading every row ID first. The small selection module has no runtime dependencies; the example connects it to TanStack Table and a local, read-only server.

This addresses a recurring integration question: [selecting all pages when data is not loaded](https://github.com/TanStack/table/discussions/3513) and [the difference between client and server pagination](https://github.com/TanStack/table/issues/4781). In August 2026, a [TanStack maintainer explained](https://github.com/TanStack/table/issues/4781#issuecomment-5192037966) that applications need their own flag and logic for this behavior. A [related report](https://github.com/TanStack/table/issues/6039) concerns the page header's mixed state. These are examples of demand, not a prevalence survey or evidence that every reported v8 behavior persists in v9.

## Three different selections

| Intent | Stored state | What the page header means |
| --- | --- | --- |
| Select this page | Add the page's eligible IDs | Every eligible row on this page is selected |
| Keep individual choices across pages | `mode: 'include'` with selected IDs | Check only the current page, even when another page has selected rows |
| Select every eligible match | `mode: 'exclude'` with deselected IDs | Project the all-matching choice onto each loaded page |

For example, selecting all 20 eligible matches and unchecking one row stores one excluded ID. New pages can display their selected state from that descriptor. The server resolves the same descriptor against the matching eligible dataset when an operation is requested.

The table's selected-row model only describes rows it has received. The [v8 guide](https://tanstack.com/table/v8/docs/guide/row-selection) explains that distinction, and the [v9 row-selection implementation](https://cdn.jsdelivr.net/npm/@tanstack/table-core@9.2.4/dist/features/row-selection/rowSelectionFeature.utils.js) still operates on known row models and explicit ID maps. This example provides application logic; it does not patch TanStack.

## Run the complete example

[Download the source ZIP](https://github.com/tevinch/data-shape-kit/raw/refs/heads/main/downloads/cross-page-selection-v0.1.0.zip), extract it, and run from its directory with Node.js 22.12 or newer:

```sh
npm ci --ignore-scripts
npm test
npm run typecheck
npm run build
npm start
```

Open the loopback URL printed by the server. The example pins React 19.3.0, TanStack Table 9.2.4, Vite 8.2.2 and TypeScript 7.0.2. A different local port can be set with `PORT` if the default is occupied. The example requires HTTP and the supplied local API; opening the HTML directly from the filesystem is not supported.

The server owns 23 invented catalog records. Three are ineligible for selection. The browser receives five rows per page. The **Select all eligible matches** action changes the compact descriptor; it does not fetch every ID. **Preview selection** asks the server to resolve it and return the selected count plus up to five sample rows. This is a preview with no writes or persistent state.

Try these flows:

1. Select a row, change pages, select another and return. Both choices persist by ID.
2. Clear the selection, select every eligible match, then uncheck a row. It stays excluded across pages and sorting changes.
3. Compare the page checkbox with the overall count. A page may be fully selected while another page has an exclusion.
4. Preview the server result, then change the category. Selection resets because the matching set changed.
5. Choose the empty category. Selection-changing controls are unavailable, while Preview remains available and resolves zero matches.

## Reuse the module

Copy `selection.mjs`, `selection.d.mts` and `LICENSE`. The declaration file supplies TypeScript types. Neither React nor TanStack is required for these functions:

```js
import {
  selectAllMatching,
  setSelected,
  pageSelection,
  selectedCount,
} from './selection.mjs';

let selection = selectAllMatching('catalog-v1:Guides');
selection = setSelected(selection, ['item-004'], false);

console.log(selection);
// { scope: 'catalog-v1:Guides', mode: 'exclude', ids: ['item-004'] }
console.log(selectedCount(selection, 10)); // 9

const page = { scope: 'catalog-v1:Guides', ids: ['item-002', 'item-004'] };
console.log(pageSelection(selection, page)); // own property: item-002 -> true
```

State objects and their ID arrays are frozen. Calls return new state and do not mutate previous snapshots. `JSON.stringify(selection)` is the wire descriptor; use `readSelection(JSON.parse(text))` to validate and clone a received descriptor. The wire format is:

```ts
type Selection = {
  readonly scope: string;
  readonly mode: 'include' | 'exclude';
  readonly ids: readonly string[];
};
```

| Function | Purpose |
| --- | --- |
| `emptySelection(scope)` | Start with no individually selected IDs |
| `selectAllMatching(scope)` | Select the scope's entire eligible set, with no exclusions |
| `readSelection(value)` | Validate an unknown descriptor and return an immutable copy |
| `isSelected(selection, id)` | Check membership; caller supplies an eligible member of the scope |
| `setSelected(selection, ids, selected)` | Select or deselect the supplied IDs |
| `selectedCount(selection, eligibleTotal)` | Count against the eligible total from the same fixed scope |
| `pageSelection(selection, page)` | Produce a TanStack-compatible map for eligible loaded IDs |
| `applyPageUpdate(selection, page, updater)` | Reconcile a map or functional updater for that page only |

Scopes and IDs are nonempty strings. Duplicate IDs are deduplicated. Invalid types or descriptors throw `TypeError`; mismatched page scopes and impossible totals throw `RangeError`. Page updates change only the supplied eligible page IDs. Missing or false own values deselect; unknown off-page keys cannot overwrite another page's choices. Updater functions must return a boolean row map synchronously; an async function or Promise is rejected. Page maps safely support string IDs such as `__proto__`.

Memory grows with explicitly selected IDs in include mode, or exceptions in exclude mode. The module does not claim constant-cost updates: immutable updates copy the stored IDs, and projecting a page examines its IDs.

## Connect controlled row selection

The complete React implementation is in [app.tsx](app.tsx). It uses the current [v9 external-state pattern](https://tanstack.com/table/latest/docs/framework/react/examples/basic-external-state) with the [row-selection feature](https://tanstack.com/table/latest/docs/framework/react/examples/row-selection). The essential wiring, once a page and its selection scope agree, is:

```js
const page = {
  scope: response.scope,
  ids: response.rows.filter(row => row.selectable).map(row => row.id),
};

// Inside the table options:
state: { rowSelection: pageSelection(selection, page), pagination },
getRowId: row => row.id,
enableRowSelection: row => row.original.selectable,
onRowSelectionChange: updater => setSelection(previous => {
  if (previous.scope !== page.scope) return previous; // stale page event
  return applyPageUpdate(previous, page, updater);
}),
```

Keep **select this page** and **select all matches** as separate controls. The page header's checked/mixed state must be derived from eligible rows on that page. Use stable record IDs rather than a page-relative array index. Keep the compact descriptor as the source of truth; a loaded-page row map cannot enumerate unseen selections.

For a v8 application, the corresponding adapter shape uses `useReactTable`, `getCoreRowModel()` and the same controlled `rowSelection`/`onRowSelectionChange` pair. The core/page-map representation accepts v8-style false values, but the runnable framework integration in this download targets v9. It is not a tested v8 application or a complete v8-to-v9 migration guide.

## The server contract matters

The descriptor describes selection intent. It does not fetch data, create an immutable database snapshot, verify membership, or grant permission to operate on records.

The server must resolve the scope to its own query and eligibility rules, then use included IDs or all matching eligible records minus excluded IDs. In this example, [demo-data.mjs](demo-data.mjs) and [server.mjs](server.mjs) implement the complete read-only flow over the invented catalog. The server rejects unknown scopes and IDs outside the eligible matching set, including ineligible IDs supplied as exclusions.

The local endpoints can also be tried without the React page:

```sh
curl 'http://127.0.0.1:8780/api/page?category=all&pageIndex=0&sort=asc'

curl 'http://127.0.0.1:8780/api/preview' \
  -H 'Content-Type: application/json' \
  -d '{"scope":"catalog-v1:all","mode":"exclude","ids":["item-002"]}'
```

The first response has five rows, `rowCount: 23` and `eligibleCount: 20`. The preview has `count: 19` and at most five sample rows; it excludes `item-002` and every ineligible row. Use the port printed at startup if you set a different `PORT`.

For a real application, define these invariants before adopting all-matching selection:

- A scope identifies the result membership **and eligibility revision**. Page index and sorting alone do not change membership.
- A filter, dataset version or eligibility change resets selection or creates a new server-supported scope. An unchanged filter string alone does not prove an unchanged dataset.
- `eligibleTotal` and every included/excluded ID belong to that same scope. Otherwise a subtraction can produce a plausible but incorrect count.
- If the application needs selection as it existed at a particular moment, the backend must support that snapshot or revision. This module cannot provide snapshot semantics for a changing database.
- The real operation must apply the application's current access and business rules. The local fixture preview is not production authorization or a batch-write endpoint.

Do not silently keep an all-matching choice after replacing its scope. Abort or ignore superseded page requests, disable controls for stale rows and hide a preview if the selection changes before its response returns. The supplied UI demonstrates those boundaries.

## Scope and verification

The module supports flat sets of eligible string IDs, explicit choices, all-matching exceptions and controlled page updates. The example includes only category filtering, sorting, paging and read-only result preview. It does not implement tree/range selection, background jobs, database queries, concurrent database snapshots or bulk mutations.

`npm test` runs behavior and actual-library/HTTP integration checks; `npm run typecheck` checks the TSX integration. Run the **built** page to check browser interaction as well. A passing fixture suite does not establish production database correctness or every browser/framework combination.

Verified on September 10, 2026 with Node.js 24.19.0: all 29 Node checks, strict type checking and a production build passed. A fresh ZIP extraction installed and rebuilt successfully, producing the same four build files byte for byte. Desktop Chrome checks covered cross-page choices, all-matching exclusions, disabled rows, page-header mixed state, sorting, filter resets and server preview. Delayed-response checks confirmed that changing a row, selecting all or clearing selection discards an old preview before a fresh preview is shown.

Original code is [MIT licensed](LICENSE). Keep the license when copying it. Builds include `THIRD_PARTY_NOTICES.md` for bundled dependency notices; retain that file when sharing built output.

## Buy me a coffee, if this helped

If this saved you some time, you're welcome to buy me a coffee. Please don't feel obliged — the code stays free, and useful feedback is welcome too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please match the asset and network exactly. Fees depend on your wallet or exchange. Thank you! — Tevinch
