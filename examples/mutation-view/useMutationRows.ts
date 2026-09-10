import {
  notifyManager,
  useQueryClient,
  type MutationCache,
} from '@tanstack/react-query';
import { useMemo, useSyncExternalStore } from 'react';

import { toMutationRow, type MutationRow } from './mutation-rows.js';

function createMutationRowsStore(mutationCache: MutationCache) {
  let rows: readonly MutationRow[] = [];

  function getSnapshot(): readonly MutationRow[] {
    const mutations = mutationCache.getAll();
    const unchanged =
      mutations.length === rows.length &&
      mutations.every((mutation, index) => {
        const row = rows[index];
        return (
          row !== undefined &&
          row.id === mutation.mutationId &&
          row.mutationKey === mutation.options.mutationKey &&
          row.state === mutation.state
        );
      });

    if (!unchanged) {
      rows = mutations.map(toMutationRow);
    }

    return rows;
  }

  function subscribe(onStoreChange: () => void) {
    return mutationCache.subscribe(notifyManager.batchCalls(onStoreChange));
  }

  return { getSnapshot, subscribe };
}

export function useMutationRows(): readonly MutationRow[] {
  const mutationCache = useQueryClient().getMutationCache();
  const store = useMemo(
    () => createMutationRowsStore(mutationCache),
    [mutationCache],
  );

  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
}
