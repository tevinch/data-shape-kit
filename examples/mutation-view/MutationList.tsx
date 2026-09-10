import type { ReactNode } from 'react';

import { useMutationRows } from './useMutationRows.js';

export type MutationListProps = {
  selectedKey: string | null;
  formatVariable?: (value: unknown) => ReactNode;
};

function defaultFormatVariable(value: unknown): ReactNode {
  return String(value);
}

export function MutationList({
  selectedKey,
  formatVariable = defaultFormatVariable,
}: MutationListProps) {
  const rows = useMutationRows();
  const visible = rows.filter(
    (row) =>
      row.state.status === 'pending' &&
      (selectedKey === null || row.mutationKey?.[0] === selectedKey),
  );

  return (
    <section aria-label="Pending operations">
      <p>
        Pending operations:{' '}
        <output aria-label="Pending operation count">{visible.length}</output>
      </p>
      {visible.length === 0 ? (
        <p>No pending operations.</p>
      ) : (
        <ul>
          {visible.map((row) => (
            <li key={row.id}>{formatVariable(row.state.variables)}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
