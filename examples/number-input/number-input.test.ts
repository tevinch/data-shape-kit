import assert from 'node:assert/strict';
import test from 'node:test';

import { optionalNumberInput, requiredNumberInput } from './number-input.js';

test('optional input treats blank values as missing while preserving zero', () => {
  for (const value of ['', ' \t\n', '\u00a0', null, undefined]) {
    assert.equal(optionalNumberInput.parse(value), undefined);
  }

  assert.equal(optionalNumberInput.parse('0'), 0);
  assert.equal(optionalNumberInput.parse(0), 0);
  assert.ok(Object.is(optionalNumberInput.parse(-0), -0));
  assert.ok(Object.is(optionalNumberInput.parse('-0'), -0));
});

test('numeric strings use complete JavaScript Number conversion', () => {
  const cases: ReadonlyArray<readonly [string | number, number]> = [
    [' 12.5 ', 12.5],
    ['-7.25', -7.25],
    ['1e3', 1000],
    ['0x10', 16],
    ['0b11', 3],
    ['0o10', 8],
    [4.75, 4.75],
  ];

  for (const [input, expected] of cases) {
    assert.equal(optionalNumberInput.parse(input), expected);
    assert.equal(requiredNumberInput.parse(input), expected);
  }
});

test('required input rejects empty values and accepts zero', () => {
  for (const value of ['', '  ', '\u00a0', null, undefined]) {
    assert.equal(requiredNumberInput.safeParse(value).success, false);
  }

  assert.equal(requiredNumberInput.parse('0'), 0);
  assert.equal(requiredNumberInput.parse(0), 0);
  assert.ok(Object.is(requiredNumberInput.parse(-0), -0));
  assert.ok(Object.is(requiredNumberInput.parse('-0'), -0));
});

test('both schemas reject invalid and non-finite numeric values', () => {
  const invalidValues: unknown[] = [
    '12px',
    '-',
    '.',
    '1,5',
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    true,
    false,
    [],
    [1],
    {},
    1n,
    Symbol('number'),
  ];

  for (const value of invalidValues) {
    assert.equal(optionalNumberInput.safeParse(value).success, false);
    assert.equal(requiredNumberInput.safeParse(value).success, false);
  }
});

test('unexpected objects are rejected without conversion or mutation', () => {
  let valueOfCalls = 0;
  const input = {
    stable: true,
    valueOf() {
      valueOfCalls += 1;
      return 42;
    },
  };

  assert.equal(optionalNumberInput.safeParse(input).success, false);
  assert.equal(requiredNumberInput.safeParse(input).success, false);
  assert.equal(valueOfCalls, 0);
  assert.deepEqual(input, { stable: true, valueOf: input.valueOf });
});
