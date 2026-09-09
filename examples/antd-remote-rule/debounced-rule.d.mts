import type {
  RemoteChecker,
  RemoteCheckOptions,
} from '../remote-field-check/remote-check.mjs';

export interface DebouncedRuleOptions extends RemoteCheckOptions {
  getValue: () => unknown;
  isEligible: (value: string) => boolean;
  /** Message used for checker failures, malformed replies, and timeouts. */
  errorMessage?: string;
}

export interface DebouncedRule {
  validator(rule: unknown, value: unknown): Promise<void>;
  runImmediately<T>(callback: () => T | PromiseLike<T>): Promise<T>;
  cancel(): void;
}

export function createDebouncedRule(
  check: RemoteChecker,
  options: DebouncedRuleOptions,
): Readonly<DebouncedRule>;
