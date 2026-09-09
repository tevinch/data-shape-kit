import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { createRemoteCheck } from './remote-check.mjs';
import type { RemoteChecker, RemoteCheckController, RemoteCheckOptions } from './remote-check.mjs';

/** Keep check referentially stable (module function or useCallback). */
export function useRemoteCheckController(check: RemoteChecker, options: RemoteCheckOptions = {}): RemoteCheckController {
  const { delayMs = 300, timeoutMs = 10000 } = options;
  const controller = useMemo(() => createRemoteCheck(check, { delayMs, timeoutMs }), [check, delayMs, timeoutMs]);
  // cancel is reusable: StrictMode's setup/cleanup rehearsal does not destroy it.
  useEffect(() => () => controller.cancel(), [controller]);
  return controller;
}

/** Subscribe at the field boundary so remote transitions need not rerender a form. */
export function useRemoteCheckState(controller: RemoteCheckController) {
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
}
