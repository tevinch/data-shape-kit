import { useLayoutEffect } from 'react';

export type RenderCountStore = Readonly<{
  record(key: string): void;
  reset(): void;
  getSnapshot(): Readonly<Record<string, number>>;
  subscribe(listener: () => void): () => void;
}>;

const emptySnapshot: Readonly<Record<string, number>> = Object.freeze({});

export function createRenderCountStore(): RenderCountStore {
  let snapshot = emptySnapshot;
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of [...listeners]) listener();
  };

  return {
    record(key) {
      snapshot = Object.freeze({
        ...snapshot,
        [key]: (snapshot[key] ?? 0) + 1,
      });
      notify();
    },
    reset() {
      snapshot = emptySnapshot;
      notify();
    },
    getSnapshot() {
      return snapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useCommittedRenderCount(
  counts: RenderCountStore,
  key: string,
): void {
  useLayoutEffect(() => {
    counts.record(key);
  });
}
