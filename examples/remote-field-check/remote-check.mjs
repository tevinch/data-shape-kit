const IDLE = Object.freeze({ status: 'idle' });
const MAX_TIMER = 2 ** 31 - 1;

/** One field's remote check lifecycle. No network policy or settled-result cache. */
export function createRemoteCheck(check, options = {}) {
  const { delayMs = 300, timeoutMs = 10000 } = options;
  if (typeof check !== 'function') throw new TypeError('check must be a function');
  for (const [name, value, minimum] of [['delayMs', delayMs, 0], ['timeoutMs', timeoutMs, 1]]) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > MAX_TIMER) {
      throw new RangeError(`${name} must be a finite number from ${minimum} to ${MAX_TIMER}`);
    }
  }

  let snapshot = IDLE;
  let active = null;
  const listeners = new Set();
  const notify = () => {
    for (const listener of [...listeners]) {
      if (listeners.has(listener)) listener();
    }
  };
  const clear = (task) => {
    clearTimeout(task.delayTimer);
    clearTimeout(task.timeoutTimer);
  };
  const discard = (task) => {
    clear(task);
    task.resolve(Object.freeze({ status: 'cancelled', value: task.value }));
    // Settle before abort: callbacks may ignore the signal or reenter the controller.
    task.abort.abort();
  };
  const finish = (task, result, abort = false) => {
    if (active !== task) return;
    active = null;
    clear(task);
    snapshot = Object.freeze({ ...result, value: task.value });
    task.resolve(snapshot);
    if (abort) task.abort.abort();
    notify();
  };
  const start = (task) => {
    if (active !== task || task.phase !== 'waiting') return;
    task.phase = 'checking';
    clearTimeout(task.delayTimer);
    snapshot = Object.freeze({ status: 'checking', value: task.value });
    task.timeoutTimer = setTimeout(() => finish(task, { status: 'error', reason: 'timeout' }, true), timeoutMs);
    notify();
    if (active !== task) return;
    let result;
    try {
      result = check(task.value, { signal: task.abort.signal });
    } catch (error) {
      finish(task, { status: 'error', reason: 'check-failed', error });
      return;
    }
    Promise.resolve(result).then(
      (message) => {
        if (message === null) finish(task, { status: 'valid' });
        else if (typeof message === 'string' && message.trim().length > 0) {
          finish(task, { status: 'invalid', message });
        } else finish(task, { status: 'error', reason: 'invalid-result' });
      },
      (error) => finish(task, { status: 'error', reason: 'check-failed', error }),
    );
  };
  const request = (value, immediate) => {
    if (typeof value !== 'string') throw new TypeError('value must be a string');
    if (active?.value === value) {
      const task = active;
      if (immediate) start(task);
      return task.promise;
    }
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    const task = { value, promise, resolve, phase: 'waiting', abort: new AbortController(), delayTimer: undefined, timeoutTimer: undefined };
    const previous = active;
    active = task;
    // Install the new identity before aborting the old one. An abort handler may
    // synchronously replace this task, in which case it must never start later.
    if (previous) discard(previous);
    if (active !== task) return promise;
    if (immediate) start(task);
    else {
      snapshot = Object.freeze({ status: 'waiting', value });
      task.delayTimer = setTimeout(() => start(task), delayMs);
      notify();
    }
    return promise;
  };
  return Object.freeze({
    schedule: (value) => request(value, false),
    checkNow: (value) => request(value, true),
    cancel() {
      const previous = active;
      active = null;
      snapshot = IDLE;
      if (previous) discard(previous);
      notify();
    },
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    isCurrent: (outcome) => outcome === snapshot && ['valid', 'invalid', 'error'].includes(snapshot.status),
  });
}
