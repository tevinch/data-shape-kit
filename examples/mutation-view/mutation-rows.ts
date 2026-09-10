import type {
  DefaultError,
  Mutation,
  MutationKey,
  MutationState,
} from '@tanstack/react-query';

export type MutationRow<
  TData = unknown,
  TError = DefaultError,
  TVariables = unknown,
  TOnMutateResult = unknown,
> = {
  id: number;
  mutationKey: MutationKey | undefined;
  state: MutationState<TData, TError, TVariables, TOnMutateResult>;
};

export function toMutationRow<
  TData = unknown,
  TError = DefaultError,
  TVariables = unknown,
  TOnMutateResult = unknown,
>(
  mutation: Mutation<TData, TError, TVariables, TOnMutateResult>,
): MutationRow<TData, TError, TVariables, TOnMutateResult> {
  return {
    id: mutation.mutationId,
    mutationKey: mutation.options.mutationKey,
    state: mutation.state,
  };
}
