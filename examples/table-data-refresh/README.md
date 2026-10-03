# Refresh extracted Table components when external data changes

A reusable TanStack Table component can keep displaying old rows when its data is replaced, even though `getRowModel()` has newer data. This example connects external data changes to a component registered with `createTableHook`, while retaining sorting, filtering and pagination.

It uses TanStack Table **9.2.4**, React **19.3.0**, React Store **0.11.2** and React Compiler **1.0.0**. The source is an application integration example; it does not patch Table.

## Run it

With Node.js 22 or newer, download or clone this repository, enter this directory, and run:

```sh
npm ci --ignore-scripts
npm test
npm start
```

Open [the local example](http://127.0.0.1:8785). Click **Update data** or **Start updates**. The source and visible rows should show the same revision. Updates also rotate the source rows, so stale ordering is visible.

`npm test` checks TypeScript, builds with React Compiler, and verifies that the components were compiled while the row-model hook retains its explicit dependencies. It does not run browser interaction tests.

## Use the pattern

[main.tsx](main.tsx) contains the complete example. There are two separate change sources:

- External data travels through `DataContext`. Put its provider above the extracted components and pass **the exact same data reference** that you pass to `useAppTable`. This avoids forwarding unused data props through intermediate components.
- Feature state travels through `useSelector(table.store, state => state)`. This example selects all state for correctness; narrow it only when every dependency of the rendered row model is accounted for.

The body reads both sources and passes them to a small hook:

```tsx
function useCurrentRows(table, data, state) {
  'use no memo';
  return React.useMemo(
    () => table.getRowModel().rows,
    [table, data, state],
  );
}
```

Keep the directive in this hook. In the checked compiler output, the same `useMemo` inside a compiled component lost its extra data/state dependencies and cached the row-model read against the table object. The hook retains these invalidation dependencies; `Body`, `Grid`, the intermediate `Spacer`, the controls and the owner component are still compiled. This is a temporary compatibility boundary: recheck the original behavior when upgrading Table or the compiler.

`table.optionsStore` is not a working substitute in the checked React adapter: its runtime value is `undefined` in 9.2.4. The generic API mentions options subscriptions, but the React adapter keeps options as plain resolved data.

Replace arrays and changed row objects immutably. Keep each table's data provider scoped to that table. The example uses fixed columns and a single React state source; it does not exercise a live Query client, WebSocket transport, dynamic column definitions, SSR or concurrent transitions. Apply your existing fetching logic before passing its data into the table and provider.

## Browser verification

The [original report](https://github.com/TanStack/table/issues/6601) was reproduced in its linked sandbox. Software-operated Chrome checks also compared source rows with rendered cells in this example, with React Compiler enabled and memoized components. The acceptance sequence is:

1. Update data twice; verify both cell values and row order.
2. Go to page 2 with automatic page reset off, then update twice; keep page 2 and display its current rows.
3. Sort both ways and filter for `ta`; continue updating while those controls remain active.
4. Empty the data and populate it again; keep the selected sorting and filter.
5. Clear the filter using the keyboard, enable automatic page reset, go to page 2, and update; return to page 1.
6. Start two-second updates and observe several new revisions without interacting with sorting or pagination.

These are browser checks of this example, not confirmation that the original author has adopted it. The source and build checks are free under the repository's [MIT license](../../LICENSE).

References: [Table's React Compiler guide](https://tanstack.com/table/latest/docs/framework/react/guide/react-compiler), [React adapter implementation](https://github.com/TanStack/table/blob/main/packages/react-table/src/reactivity.ts), and [React's function-level compiler opt-out](https://react.dev/reference/react-compiler/directives/use-no-memo).

## Optional coffee

If this saved you some time, a coffee is welcome. Please use the example freely either way.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
