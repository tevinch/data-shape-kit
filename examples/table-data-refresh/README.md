# Refresh extracted Table components when external data changes

A reusable TanStack Table component can keep displaying old rows when its data is replaced, even though `getRowModel()` has newer data. This example keeps an extracted table current while retaining sorting, filtering and pagination.

It uses TanStack Table **9.3.1**, React **19.3.0**, React Store **0.11.2** and React Compiler **1.0.0**. It follows the released `AppTable` behavior and does not patch Table.

## Use the released fix

[Table 9.3.1](https://github.com/TanStack/table/releases/tag/%40tanstack/react-table%409.3.1) includes [PR #6631](https://github.com/TanStack/table/pull/6631), which refreshes `AppTable` context when its owner receives new data, including when React Compiler or memoization caches the element. For this example, the extra data Context and `use no memo` hook from the earlier 9.2.4 version are no longer needed.

This was checked on October 13, 2026 using the npm release. With the same simplified example, **9.2.8** keeps the initial rows after the first external update; **9.3.1** passes the complete sequence below. These are software-operated Chrome checks, not confirmation that the original reporter has adopted the release.

The fix covers `useTableContext()` consumers inside `AppTable`. A component receiving `table` as a plain prop outside that context still needs data or rendered rows passed through its props when external data changes. See the [official React Compiler guide](https://tanstack.com/table/latest/docs/framework/react/guide/react-compiler).

## Run it

With Node.js 22 or newer, download or clone this repository, enter this directory, and run:

```sh
npm ci --ignore-scripts
npm test
npm start
```

Open [the local example](http://127.0.0.1:8785). Click **Update data** or **Start updates**. The source and visible rows should show the same revision. Updates also rotate the source rows, so stale ordering is visible.

`npm test` checks TypeScript, builds with React Compiler, and verifies that all five components were actually compiled. To run the browser acceptance sequence, install Google Chrome and run this after `npm test`:

```sh
npm run test:browser
```

The browser check starts its own local server and a separate headless Chrome session. It writes results and a screenshot into `dist/` and exits unsuccessfully when an expected result differs. It does not use your signed-in browser profile.

## Use the pattern

[main.tsx](main.tsx) contains the complete example. There are two separate change sources:

- External data reaches the owner of `useAppTable`. Its `AppTable` provider refreshes the context consumed by the extracted body.
- Sorting, filtering and pagination update table state. Keep those state-dependent row-model reads inside the `table.Subscribe` render function.

```tsx
function Body() {
  const table = useTableContext<Item>();
  return (
    <table.Subscribe selector={state => state}>
      {() => (
        <tbody>
          {table.getRowModel().rows.map(row => (
            <tr key={row.id}>
              {row.getAllCells().map(cell => (
                <td key={cell.id}><table.FlexRender cell={cell} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      )}
    </table.Subscribe>
  );
}
```

This example selects all table state. You can narrow the selection when it still includes every feature that changes the displayed row model. A state subscription alone does not detect new external data; the `AppTable` context supplies that update here.

Replace arrays and changed row objects immutably. Keep each table under its own `AppTable`. The example uses fixed columns and one React state source; it does not exercise a live Query client, WebSocket transport, dynamic columns, SSR, concurrent transitions or Preact. Apply existing fetching logic before passing its data to the table.

## Browser verification

The checked workflow comes from [the external-data report](https://github.com/TanStack/table/issues/6601). The browser check exercises the compiled, memoized example with React Strict Mode enabled:

1. Replace data twice; verify current cell values and row order.
2. Go to page 2 with automatic page reset off, then update twice; keep page 2 and display its current rows.
3. Sort ascending, update, return to page 1, filter for `ta`, update again, then sort descending.
4. Empty the data and populate it again; keep the sorting and filter.
5. Clear filtering and sorting, enable automatic page reset, go to page 2, and update; return to page 1.
6. Start actual two-second updates, observe three successive revisions without sorting or paging, then stop.

All **20 checkpoints** passed on 9.3.1 in Google Chrome 155.0.8059.40. The 9.2.8 control fails at the first data replacement while its source data has advanced. The compiler log independently confirms that `Body`, `Controls`, `Grid`, `Spacer` and `App` were compiled. Human manual testing and original-user adoption are not claimed.

The example and its checks are free under the repository's [MIT license](../../LICENSE).

## Optional coffee

If this saved you some time, a coffee is welcome. Please use the example freely either way.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
