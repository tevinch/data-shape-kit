export type RemoteChecker = (
  value: string,
  context: { signal: AbortSignal },
) => null | string | PromiseLike<null | string>;

export interface RemoteCheckOptions {
  /** Debounce delay in milliseconds; default 300. */
  delayMs?: number;
  /** Deadline measured from check start; default 10000 milliseconds. */
  timeoutMs?: number;
}
export type RemoteTerminal =
  | Readonly<{ status: 'valid'; value: string }>
  | Readonly<{ status: 'invalid'; value: string; message: string }>
  | Readonly<{ status: 'error'; value: string; reason: 'timeout' | 'check-failed' | 'invalid-result'; error?: unknown }>;
export type RemoteOutcome = RemoteTerminal | Readonly<{ status: 'cancelled'; value: string }>;
export type RemoteSnapshot =
  | Readonly<{ status: 'idle' }>
  | Readonly<{ status: 'waiting' | 'checking'; value: string }>
  | RemoteTerminal;

export interface RemoteCheckController {
  schedule(value: string): Promise<RemoteOutcome>;
  checkNow(value: string): Promise<RemoteOutcome>;
  cancel(): void;
  getSnapshot(): RemoteSnapshot;
  /** Listeners should be synchronous and must not throw. */
  subscribe(listener: () => void): () => void;
  /** True only for the exact terminal outcome still exposed by getSnapshot. */
  isCurrent(outcome: RemoteOutcome): boolean;
}
export function createRemoteCheck(check: RemoteChecker, options?: RemoteCheckOptions): RemoteCheckController;
