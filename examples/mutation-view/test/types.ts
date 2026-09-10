import type { Mutation, MutationState } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

import { MutationList } from '../MutationList.js';
import { toMutationRow, type MutationRow } from '../mutation-rows.js';
import { useMutationRows } from '../useMutationRows.js';

type Data = { accepted: true };
type Variables = { id: number; label: string };
type Context = { previousId: number };

declare const mutation: Mutation<Data, TypeError, Variables, Context>;
const row = toMutationRow(mutation);

const id: number = row.id;
const key: readonly unknown[] | undefined = row.mutationKey;
const state: MutationState<Data, TypeError, Variables, Context> = row.state;
const sameRowType: MutationRow<Data, TypeError, Variables, Context> = row;

const formatter = (value: unknown): ReactNode =>
  typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);

createElement(MutationList, { selectedKey: null });
createElement(MutationList, { formatVariable: formatter, selectedKey: '' });
createElement(MutationList, { selectedKey: 'save' });

const rows: readonly MutationRow[] = useMutationRows();

// @ts-expect-error Hook snapshots are read-only to consumers.
rows.push(row);

declare const unknownMutation: Mutation;
const unknownVariables = toMutationRow(unknownMutation).state.variables;

// @ts-expect-error Cache variables stay unknown until a consumer narrows them.
const guaranteedString: string = unknownVariables;

void [id, key, state, sameRowType, rows, guaranteedString];
