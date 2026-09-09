import assert from 'node:assert/strict';
import test from 'node:test';

import { zodResolver } from '@hookform/resolvers/zod';

import { formSchema } from './form-schema.js';

test('form requires count and keeps a blank measurement absent', () => {
  const missingCount = formSchema.safeParse({ count: '', measurement: '' });
  assert.equal(missingCount.success, false);
  if (!missingCount.success) {
    assert.deepEqual(missingCount.error.issues[0]?.path, ['count']);
  }

  assert.deepEqual(formSchema.parse({ count: '0', measurement: '' }), {
    count: 0,
    measurement: undefined,
  });
});

test('form accepts numeric reset values and decimal measurement text', () => {
  assert.deepEqual(formSchema.parse({ count: 0, measurement: 12.5 }), {
    count: 0,
    measurement: 12.5,
  });
  assert.deepEqual(formSchema.parse({ count: '4', measurement: ' 3.75 ' }), {
    count: 4,
    measurement: 3.75,
  });
});

test('form reports the constrained field for fractional, negative, and out-of-range inputs', () => {
  const cases: ReadonlyArray<readonly [Record<string, unknown>, string]> = [
    [{ count: '1.5', measurement: '' }, 'count'],
    [{ count: '-1', measurement: '' }, 'count'],
    [{ count: '101', measurement: '' }, 'count'],
    [{ count: '1', measurement: '-0.1' }, 'measurement'],
    [{ count: '1', measurement: '100.1' }, 'measurement'],
  ];

  for (const [input, expectedField] of cases) {
    const result = formSchema.safeParse(input);
    assert.equal(result.success, false);
    if (!result.success) {
      assert.deepEqual(result.error.issues[0]?.path, [expectedField]);
    }
  }
});

test('valid and invalid parses remain independent across repeated round trips', () => {
  assert.deepEqual(formSchema.parse({ count: '2', measurement: '3' }), {
    count: 2,
    measurement: 3,
  });
  assert.equal(formSchema.safeParse({ count: 'bad', measurement: '3' }).success, false);
  assert.deepEqual(formSchema.parse({ count: '5', measurement: '' }), {
    count: 5,
    measurement: undefined,
  });
});

test('the real resolver returns transformed values and field errors', async () => {
  const resolver = zodResolver(formSchema);
  const options = {
    criteriaMode: 'firstError' as const,
    fields: {},
    shouldUseNativeValidation: false,
  };

  const valid = await resolver({ count: '0', measurement: '12.5' }, undefined, options);
  assert.deepEqual(valid, {
    errors: {},
    values: { count: 0, measurement: 12.5 },
  });

  const blankOptional = await resolver({ count: '7', measurement: '' }, undefined, options);
  assert.deepEqual(blankOptional, {
    errors: {},
    values: { count: 7, measurement: undefined },
  });

  const invalid = await resolver({ count: '', measurement: 'bad' }, undefined, options);
  assert.deepEqual(Object.keys(invalid.values), []);
  assert.deepEqual(Object.keys(invalid.errors).sort(), ['count', 'measurement']);
  assert.equal(invalid.errors.count?.ref, undefined);
  assert.equal(invalid.errors.measurement?.ref, undefined);
});
