// Copyright (c) 2026 Tevinch. SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { demoCheck } from './demo-check.mjs';

test('the reserved demo slug produces a validation message', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const result = demoCheck('taken', { signal: new AbortController().signal });
  t.mock.timers.tick(400);
  assert.equal(await result, 'This example slug is already in use.');
});

test('ordinary and slow demo slugs finish with a valid result', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const signal = new AbortController().signal;
  const ordinary = demoCheck('available', { signal });
  const slow = demoCheck('slow', { signal });
  let slowFinished = false;
  void slow.then(() => { slowFinished = true; });
  t.mock.timers.tick(400);
  assert.equal(await ordinary, null);
  assert.equal(slowFinished, false);
  t.mock.timers.tick(1000);
  assert.equal(await slow, null);
});

test('the offline demo slug rejects instead of implying availability', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const result = demoCheck('offline', { signal: new AbortController().signal });
  const rejected = assert.rejects(result, /simulated service failure/i);
  t.mock.timers.tick(400);
  await rejected;
});

test('abort stops a delayed or stalled demo check', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const value of ['slow', 'timeout']) {
    const controller = new AbortController();
    const result = demoCheck(value, { signal: controller.signal });
    const rejected = assert.rejects(result, { name: 'AbortError' });
    controller.abort();
    await rejected;
  }
  t.mock.timers.tick(10000);
});

test('an already aborted check never starts a new delay', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(demoCheck('available', { signal: controller.signal }), { name: 'AbortError' });
});
