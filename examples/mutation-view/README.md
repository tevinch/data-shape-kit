# Mutation view

Keep a pending-operation list current when its selected category changes. This free React example subscribes to mutation rows, then filters and formats them during render. It uses public React Query APIs and does not modify installed dependencies.

## The problem

In [`useMutationState` issue #11272](https://github.com/TanStack/query/issues/11272), changing the hook's `filters` can leave its previous result visible until another mutation-cache event occurs. The included reproduction checks the official `@tanstack/react-query@5.102.8` release with React 19.3.0: two pending values remain `[1, 2]` after selecting the first key, although the expected result is `[1]`.

[Upstream PR #11329](https://github.com/TanStack/query/pull/11329) already proposes a library fix and was open when checked on September 10, 2026. This is a separate application-level recipe for that released version. Check upstream progress when upgrading.

## Copy into your application

Copy [mutation-rows.ts](mutation-rows.ts), [useMutationRows.ts](useMutationRows.ts), and [MutationList.tsx](MutationList.tsx) into an existing TypeScript React application that uses React Query. Keep the three files together. Use your application's existing `QueryClientProvider`.

```tsx
import { useState } from 'react';
import { MutationList } from './MutationList.js';

export function PendingPanel() {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  return (
    <section>
      <label>
        Show operations
        <select
          value={selectedKey ?? 'all'}
          onChange={(event) => {
            const value = event.target.value;
            setSelectedKey(value === 'all' ? null : value);
          }}
        >
          <option value="all">All categories</option>
          <option value="save-note">Save note</option>
          <option value="upload-file">Upload file</option>
        </select>
      </label>
      <MutationList
        selectedKey={selectedKey}
        formatVariable={(value) =>
          typeof value === 'string' ? value : 'Operation in progress'
        }
      />
    </section>
  );
}
```

The list shows mutations already started elsewhere in your application, for example those with `mutationKey: ['save-note']`. The component itself starts no requests. The sample dropdown reserves `'all'` for its All option; the component's API uses `null`, so an empty string or a literal `'all'` key remains usable with your own controls.

| Prop | Meaning |
| --- | --- |
| `selectedKey` | Required. `null` shows all pending operations. A string matches exactly the **first** element of `mutationKey`; it is not a full React Query key matcher. |
| `formatVariable` | Optional. Converts an `unknown` variable to a React node. The default uses `String(value)`, including for `0`, `false` and `null`. Narrow object values before accessing fields. |

The component displays the matching pending count and a list. It displays **No pending operations.** when none match. Multiple operations with the same key remain separate rows.

## Use the pattern with your own markup

```tsx
import { useMutationRows } from './useMutationRows.js';

export function PendingCount({ selectedKey }: { selectedKey: string | null }) {
  const rows = useMutationRows();
  const visible = rows.filter(
    (row) =>
      row.state.status === 'pending' &&
      (selectedKey === null || row.mutationKey?.[0] === selectedKey),
  );
  return <output>{visible.length}</output>;
}
```

`useMutationRows()` takes no arguments and reads the current provider's mutation cache. Each row holds `id`, `mutationKey`, and the state reference captured when the snapshot is read. IDs belong to that cache; they are not global identifiers. React Query replaces mutation state as an operation progresses, so a later state can be observed while the previous row still retains the previous state. The reader compares row membership, order, key references and state references, returning the same array when these have not changed. Stable snapshot identity is required by React's `useSyncExternalStore`.

Notifications use React Query's `notifyManager.batchCalls`, so the snapshot is read after the cache operation finishes. This matters in the tested release: `MutationCache.clear()` emits its removal notifications before clearing the internal collection, and a synchronous reader can retain old rows. The included Hook observes an actually emptied cache; it also switches readers and subscriptions when the provider's client changes.

Changing `selectedKey` or your formatting function re-evaluates ordinary render code. It needs neither a dummy cache event nor a remount. You can adapt the local `filter` to other statuses or fields. The Hook intentionally has no filter or projection options.

## Run the checks

Download the [source and checks ZIP](https://github.com/tevinch/data-shape-kit/raw/refs/heads/main/downloads/mutation-view-v0.1.0.zip), extract it, and open a terminal in its `mutation-view` directory. The fixture requires Node.js 24.19.0 or newer:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm test
```

The fixture uses exact dependency versions in its lockfile: React Query 5.102.8, React and ReactDOM 19.3.0, and jsdom 30.0.1. The checks use real ReactDOM rendering and actual mutation-cache transitions with local deferred promises. They cover filter and formatter changes without cache events, matching counts, completion, new and removed records, clearing a nonempty cache, duplicate keys, falsy variables, unchanged snapshot identity and provider replacement. StrictMode cases exercise the same component across updates. Type checks cover consumer usage.

To observe the original released behavior:

```sh
npm run reproduce
```

**This command is expected to fail** with an assertion showing the stale result. It is a diagnostic comparison, separate from the passing example checks. Re-check the comparison when changing dependency versions.

## Scope and limits

- The Hook reads the entire mutation cache whenever React checks its snapshot. It compares O(N) rows and allocates a new row array when something changes; rendering also filters locally. Use this for modest lists. It is not a performance optimization for a large cache.
- The Hook reads the current `QueryClientProvider`; it has no separate client argument. Keep ordinary application clients stable, and replace the provider client only when you intend to switch caches.
- The supplied component shows pending operations only. It is not a drop-in `MutationFilters` or `useIsMutating` implementation.
- Cache retention and `gcTime` determine available history. The example adds no persistence, cancellation, retry controls or durable activity log.
- Treat rows, key arrays and their nested state/data as read-only. The reader relies on React Query replacing state references. It does not track application code that mutates existing objects in place, or deep-clone, freeze or serialize your data.
- Validation uses Node 24.19.0 and browser-like jsdom with React 19.3.0. Other React versions, server rendering and browser-specific behavior have not been verified here.

## License

[MIT](LICENSE). Copy, adapt and share the example while retaining the notice. Dependencies retain their respective licenses.

## Buy me a coffee, if this helped

This example is free, and no contribution is expected. If it saved you some time and you would like to buy me a coffee, thank you. A useful bug report or example is appreciated too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
