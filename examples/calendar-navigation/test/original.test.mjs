import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openExample } from './support.mjs';

test('original Spanish 12-month view renders without an exception (expected to fail on 7.1.0)', async t => {
  const { errors } = await openExample(t, '?original');
  t.diagnostic(`Observed browser errors: ${JSON.stringify(errors)}`);
  assert.ok(errors.some(message => message.includes('toLocaleLowerCase')), 'a different error is not the reported reproduction');
  assert.deepEqual(errors, [], 'the original configuration must render without a runtime error');
});
