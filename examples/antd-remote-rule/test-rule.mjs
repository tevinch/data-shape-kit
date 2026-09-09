import test from 'node:test';
import assert from 'node:assert/strict';
import { createDebouncedRule } from './debounced-rule.mjs';

const STALE = /Value changed\. Please validate again\./;
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const timers = (t) => t.mock.timers.enable({ apis: ['setTimeout'] });
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

test('current invalid remote result rejects with the checker message', async () => {
  let value = 'taken';
  const rule = createDebouncedRule(() => 'Code already exists', {
    getValue: () => value,
    isEligible: () => true,
    delayMs: 10,
  });

  await assert.rejects(
    rule.runImmediately(() => rule.validator(null, value)),
    /Code already exists/,
  );
});

test('validates arguments eagerly and returns a frozen reusable contract', () => {
  const getValue = () => 'alpha';
  const isEligible = () => true;
  for (const check of [undefined, null, 'check']) {
    assert.throws(() => createDebouncedRule(check, { getValue, isEligible }), /check/);
  }
  for (const options of [undefined, null, false]) {
    assert.throws(() => createDebouncedRule(() => null, options), /options/);
  }
  assert.throws(() => createDebouncedRule(() => null, { getValue: null, isEligible }), /getValue/);
  assert.throws(() => createDebouncedRule(() => null, { getValue, isEligible: null }), /isEligible/);
  for (const errorMessage of ['', '   ', null, 42]) {
    assert.throws(
      () => createDebouncedRule(() => null, { getValue, isEligible, errorMessage }),
      /errorMessage/,
    );
  }
  assert.throws(
    () => createDebouncedRule(() => null, { getValue, isEligible, delayMs: -1 }),
    /delayMs/,
  );

  const rule = createDebouncedRule(() => null, { getValue, isEligible });
  assert.ok(Object.isFrozen(rule));
  assert.equal(typeof rule.validator, 'function');
  assert.equal(typeof rule.runImmediately, 'function');
  assert.equal(typeof rule.cancel, 'function');
  assert.throws(() => rule.runImmediately(null), /callback/);
});

test('debounces eligible values while matching local failures cancel and resolve', async (t) => {
  timers(t);
  let value = 'alpha';
  const checked = [];
  const eligibilityChecks = [];
  const rule = createDebouncedRule((candidate) => {
    checked.push(candidate);
    return null;
  }, {
    getValue: () => value,
    isEligible: (candidate) => {
      eligibilityChecks.push(candidate);
      return candidate.length >= 3;
    },
    delayMs: 20,
  });

  const pending = rule.validator(null, value);
  t.mock.timers.tick(19);
  assert.deepEqual(checked, []);
  value = '';
  await rule.validator(null, value);
  await assert.rejects(pending, STALE);
  t.mock.timers.tick(1);
  assert.deepEqual(checked, []);

  value = 42;
  await rule.validator(null, value);
  value = 'bravo';
  const valid = rule.validator(null, value);
  t.mock.timers.tick(20);
  await valid;
  assert.deepEqual(checked, ['bravo']);
  assert.deepEqual(eligibilityChecks, ['alpha', '', 'bravo']);
});

test('a stale invocation does not cancel newer pending work', async (t) => {
  timers(t);
  let value = 'new';
  const checked = [];
  const rule = createDebouncedRule((candidate) => {
    checked.push(candidate);
    return null;
  }, { getValue: () => value, isEligible: () => true, delayMs: 10 });

  const current = rule.validator(null, value);
  await assert.rejects(rule.validator(null, 'old'), STALE);
  t.mock.timers.tick(10);
  await current;
  assert.deepEqual(checked, ['new']);
});

test('a newer value supersedes old work before the debounce starts', async (t) => {
  timers(t);
  let value = 'alpha';
  const checked = [];
  const rule = createDebouncedRule((candidate) => {
    checked.push(candidate);
    return null;
  }, { getValue: () => value, isEligible: () => true, delayMs: 10 });

  const old = rule.validator(null, value);
  value = 'bravo';
  const latest = rule.validator(null, value);
  await assert.rejects(old, STALE);
  t.mock.timers.tick(10);
  await latest;
  assert.deepEqual(checked, ['bravo']);
});

test('a newer value supersedes ignored-abort work and late settlement stays stale', async () => {
  let value = 'alpha';
  let oldSignal;
  const oldWork = deferred();
  const rule = createDebouncedRule((candidate, { signal }) => {
    if (candidate === 'alpha') {
      oldSignal = signal;
      return oldWork.promise;
    }
    return null;
  }, { getValue: () => value, isEligible: () => true });

  const old = rule.runImmediately(() => rule.validator(null, value));
  value = 'bravo';
  await rule.runImmediately(() => rule.validator(null, value));
  assert.equal(oldSignal.aborted, true);
  await assert.rejects(old, STALE);
  oldWork.resolve('Old failure');
  await flush();

  await rule.runImmediately(() => rule.validator(null, value));
});

test('matching same-value validators share one remote request', async (t) => {
  timers(t);
  let value = 'alpha';
  let calls = 0;
  const work = deferred();
  const rule = createDebouncedRule(() => {
    calls += 1;
    return work.promise;
  }, { getValue: () => value, isEligible: () => true, delayMs: 10 });

  const first = rule.validator(null, value);
  const second = rule.validator(null, value);
  t.mock.timers.tick(10);
  assert.equal(calls, 1);
  work.resolve(null);
  await Promise.all([first, second]);
});

test('a value change after the remote wait rejects an otherwise current success', async () => {
  let value = 'alpha';
  const work = deferred();
  const rule = createDebouncedRule(() => work.promise, {
    getValue: () => value,
    isEligible: () => true,
  });

  const validation = rule.runImmediately(() => rule.validator(null, value));
  value = 'bravo';
  work.resolve(null);
  await assert.rejects(validation, STALE);
});

test('explicit cancellation settles validation as stale and the rule remains reusable', async () => {
  let value = 'alpha';
  const work = deferred();
  let calls = 0;
  const rule = createDebouncedRule(() => {
    calls += 1;
    return calls === 1 ? work.promise : null;
  }, { getValue: () => value, isEligible: () => true });

  const cancelled = rule.runImmediately(() => rule.validator(null, value));
  rule.cancel();
  await assert.rejects(cancelled, STALE);
  value = 'bravo';
  await rule.runImmediately(() => rule.validator(null, value));
  assert.equal(calls, 2);
});

test('remote failures and malformed results expose only the generic message', async () => {
  const value = 'alpha';
  const privateError = new Error('private checker details');
  for (const check of [
    () => { throw privateError; },
    () => Promise.reject(privateError),
    () => undefined,
  ]) {
    const rule = createDebouncedRule(check, {
      getValue: () => value,
      isEligible: () => true,
      errorMessage: 'Validation service unavailable.',
    });
    await assert.rejects(
      rule.runImmediately(() => rule.validator(null, value)),
      (error) => error.message === 'Validation service unavailable.' && !error.message.includes('private'),
    );
  }
});

test('timeout uses the default generic message', async (t) => {
  timers(t);
  const value = 'alpha';
  const rule = createDebouncedRule(() => new Promise(() => {}), {
    getValue: () => value,
    isEligible: () => true,
    timeoutMs: 10,
  });

  const validation = rule.runImmediately(() => rule.validator(null, value));
  t.mock.timers.tick(10);
  await assert.rejects(validation, /Unable to validate\. Please try again\./);
});

test('runImmediately flushes debounce and propagates callback values and errors', async () => {
  const value = 'alpha';
  let calls = 0;
  const rule = createDebouncedRule(() => {
    calls += 1;
    return null;
  }, { getValue: () => value, isEligible: () => true, delayMs: 1000 });

  const marker = {};
  assert.equal(await rule.runImmediately(() => marker), marker);
  await rule.runImmediately(() => rule.validator(null, value));
  assert.equal(calls, 1);
  const failure = new Error('callback failed');
  await assert.rejects(rule.runImmediately(() => { throw failure; }), (error) => error === failure);
});

test('nested and overlapping immediate scopes remain immediate until all finish', async () => {
  const value = 'alpha';
  const checked = [];
  const outerWork = deferred();
  const rule = createDebouncedRule((candidate) => {
    checked.push(candidate);
    return null;
  }, { getValue: () => value, isEligible: () => true, delayMs: 1000 });

  const outer = rule.runImmediately(async () => {
    await rule.runImmediately(async () => 'nested');
    await outerWork.promise;
    return 'outer';
  });
  assert.equal(await rule.runImmediately(async () => 'overlap'), 'overlap');

  rule.cancel();
  await rule.validator(null, value);
  assert.deepEqual(checked, ['alpha']);
  outerWork.resolve();
  assert.equal(await outer, 'outer');
});
