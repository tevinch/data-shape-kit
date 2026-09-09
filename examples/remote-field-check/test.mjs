import test from 'node:test';
import assert from 'node:assert/strict';
import { createRemoteCheck } from './remote-check.mjs';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
const timers = (t) => t.mock.timers.enable({ apis: ['setTimeout'] });

test('debounces once and shares identical pending values without resetting delay', async (t) => {
  timers(t);
  const values = [];
  const controller = createRemoteCheck((value) => { values.push(value); return null; });
  const result = controller.schedule('alpha');
  t.mock.timers.tick(200);
  assert.equal(controller.schedule('alpha'), result);
  t.mock.timers.tick(99);
  assert.deepEqual(values, []);
  t.mock.timers.tick(1);
  assert.deepEqual(values, ['alpha']);
  assert.deepEqual(await result, { status: 'valid', value: 'alpha' });
});

test('checkNow flushes pending work and shares running work; resubmission is fresh', async (t) => {
  timers(t);
  let calls = 0;
  const work = deferred();
  const controller = createRemoteCheck(() => { calls++; return work.promise; });
  const pending = controller.schedule('alpha');
  assert.equal(controller.checkNow('alpha'), pending);
  assert.equal(calls, 1);
  assert.equal(controller.checkNow('alpha'), pending);
  work.resolve(null);
  const outcome = await pending;
  assert.ok(controller.isCurrent(outcome));
  const again = controller.checkNow('alpha');
  assert.notEqual(again, pending);
  assert.equal(calls, 2);
  assert.equal(controller.isCurrent(outcome), false);
  await again;
});

test('replacing waiting work promptly settles it without calling its checker', async (t) => {
  timers(t);
  const values = [];
  const controller = createRemoteCheck((value) => { values.push(value); return null; });
  const old = controller.schedule('alpha');
  const latest = controller.schedule('bravo');
  assert.deepEqual(await old, { status: 'cancelled', value: 'alpha' });
  t.mock.timers.tick(300);
  await latest;
  assert.deepEqual(values, ['bravo']);
});

for (const late of ['success', 'rejection']) {
  test(`ignored abort and stale ${late} cannot overwrite a newer result`, async () => {
    const oldWork = deferred();
    let signal;
    const controller = createRemoteCheck((value, context) => {
      if (value === 'alpha') { signal = context.signal; return oldWork.promise; }
      return 'Already used';
    });
    const old = controller.checkNow('alpha');
    const latest = controller.checkNow('bravo');
    assert.equal(signal.aborted, true);
    assert.equal((await old).status, 'cancelled');
    const outcome = await latest;
    if (late === 'success') oldWork.resolve(null);
    else oldWork.reject(new Error('private details'));
    await flush();
    assert.equal(controller.getSnapshot(), outcome);
    assert.deepEqual(outcome, { status: 'invalid', value: 'bravo', message: 'Already used' });
  });
}

test('cancel promptly settles ignored-abort work and resets settled state too', async () => {
  let signal;
  const controller = createRemoteCheck((_, context) => { signal = context.signal; return new Promise(() => {}); });
  const work = controller.checkNow('alpha');
  controller.cancel();
  assert.equal((await work).status, 'cancelled');
  assert.equal(signal.aborted, true);
  assert.deepEqual(controller.getSnapshot(), { status: 'idle' });
  const valid = createRemoteCheck(() => null);
  const outcome = await valid.checkNow('alpha');
  valid.cancel();
  assert.equal(valid.isCurrent(outcome), false);
  assert.deepEqual(valid.getSnapshot(), { status: 'idle' });
});

test('timeout begins after debounce and ignores late results', async (t) => {
  timers(t);
  const work = deferred();
  let signal;
  const controller = createRemoteCheck((_, context) => { signal = context.signal; return work.promise; }, { delayMs: 500, timeoutMs: 100 });
  const result = controller.schedule('alpha');
  t.mock.timers.tick(499);
  assert.equal(controller.getSnapshot().status, 'waiting');
  t.mock.timers.tick(1);
  assert.equal(signal.aborted, false);
  t.mock.timers.tick(99);
  assert.equal(controller.getSnapshot().status, 'checking');
  t.mock.timers.tick(1);
  const outcome = await result;
  assert.deepEqual(outcome, { status: 'error', value: 'alpha', reason: 'timeout' });
  assert.equal(signal.aborted, true);
  work.resolve(null);
  await flush();
  assert.equal(controller.getSnapshot(), outcome);
});

test('synchronous throws and rejected promises become check-failed errors', async () => {
  const error = new Error('private details');
  for (const check of [() => { throw error; }, () => Promise.reject(error)]) {
    const controller = createRemoteCheck(check);
    const outcome = await controller.checkNow('alpha');
    assert.deepEqual(outcome, { status: 'error', value: 'alpha', reason: 'check-failed', error });
  }
});

test('malformed results become errors; only null or nonempty strings are valid', async () => {
  for (const value of [undefined, false, true, 42, {}, '', '   ']) {
    const controller = createRemoteCheck(() => value);
    assert.deepEqual(await controller.checkNow('alpha'), { status: 'error', value: 'alpha', reason: 'invalid-result' });
  }
});

test('timing options reject invalid bounds synchronously', () => {
  for (const delayMs of [-1, NaN, Infinity, 2 ** 31, '300', null]) {
    assert.throws(() => createRemoteCheck(() => null, { delayMs }), /delayMs/);
  }
  for (const timeoutMs of [0, -1, NaN, Infinity, 2 ** 31, '100', null]) {
    assert.throws(() => createRemoteCheck(() => null, { timeoutMs }), /timeoutMs/);
  }
});

test('subscribers see stable immutable snapshots and unsubscribe cleanly', async (t) => {
  timers(t);
  const controller = createRemoteCheck(() => null);
  const seen = [];
  const stop = controller.subscribe(() => seen.push(controller.getSnapshot()));
  assert.equal(controller.getSnapshot(), controller.getSnapshot());
  const result = controller.schedule('alpha');
  assert.equal(controller.getSnapshot(), controller.getSnapshot());
  assert.ok(Object.isFrozen(controller.getSnapshot()));
  t.mock.timers.tick(300);
  const outcome = await result;
  assert.deepEqual(seen.map((x) => x.status), ['waiting', 'checking', 'valid']);
  assert.ok(Object.isFrozen(outcome));
  stop();
  controller.cancel();
  assert.equal(seen.length, 3);
  t.mock.timers.tick(10000);
  assert.deepEqual(controller.getSnapshot(), { status: 'idle' });
});

test('A to B to A never revives an earlier valid outcome', async () => {
  const controller = createRemoteCheck(() => null);
  const first = await controller.checkNow('alpha');
  await controller.checkNow('bravo');
  const last = await controller.checkNow('alpha');
  assert.equal(controller.isCurrent(first), false);
  assert.equal(controller.isCurrent({ ...last }), false);
  assert.equal(controller.isCurrent(last), true);
});

test('reentrant subscriber cancellation prevents starting a check', async (t) => {
  timers(t);
  let calls = 0;
  const controller = createRemoteCheck(() => { calls++; return null; });
  controller.subscribe(() => {
    if (controller.getSnapshot().status === 'checking') controller.cancel();
  });
  const outcome = await controller.checkNow('alpha');
  assert.equal(outcome.status, 'cancelled');
  assert.equal(calls, 0);
  t.mock.timers.tick(20000);
  assert.equal(controller.getSnapshot().status, 'idle');
});

test('abort listener reentrancy preserves the newest request and settles displaced work', async () => {
  let newest;
  const controller = createRemoteCheck((value, { signal }) => {
    if (value === 'alpha') {
      signal.addEventListener('abort', () => { newest = controller.checkNow('charlie'); });
      return new Promise(() => {});
    }
    return null;
  });
  const first = controller.checkNow('alpha');
  const displaced = controller.checkNow('bravo');
  assert.equal((await first).status, 'cancelled');
  assert.equal((await displaced).status, 'cancelled');
  assert.deepEqual(await newest, { status: 'valid', value: 'charlie' });
  assert.equal(controller.getSnapshot().value, 'charlie');
});

test('reentrant waiting subscriber can flush once without duplicate work', async (t) => {
  timers(t);
  let calls = 0;
  const controller = createRemoteCheck(() => { calls++; return null; });
  controller.subscribe(() => {
    if (controller.getSnapshot().status === 'waiting') controller.checkNow('alpha');
  });
  await controller.schedule('alpha');
  t.mock.timers.tick(20000);
  assert.equal(calls, 1);
  assert.equal(controller.getSnapshot().status, 'valid');
});
