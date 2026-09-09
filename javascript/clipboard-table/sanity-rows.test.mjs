// Copyright (c) 2026 Tevinch. SPDX-License-Identifier: MIT
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseClipboard } from './index.mjs';
import { applyGridPaste } from './sanity-rows.mjs';

const row = (key, cells, extra = {}) => ({ _key: key, _type: 'tableRow', cells, ...extra });
const base = () => [row('a', ['A1', 'A2']), row('b', ['B1', 'B2'])];
const frozen = rows => Object.freeze(rows.map(value => Object.freeze({ ...value, cells: Object.freeze(value.cells) })));

test('offset paste preserves other cells, keys, types and row metadata', () => {
  const input = frozen([row('a', ['A1', 'A2'], { label: 'keep', _type: 'customRow' }), row('b', ['B1', 'B2'])]);
  const output = applyGridPaste(input, [['00123']], 1, 1);
  assert.deepEqual(output, [row('a', ['A1', 'A2'], { label: 'keep', _type: 'customRow' }), row('b', ['B1', '00123'])]);
  assert.notEqual(output, input);
  assert.notEqual(output[0], input[0]);
  assert.notEqual(output[0].cells, input[0].cells);
});

test('growth pads existing rows and gives new rows the configured type and keys', () => {
  const input = frozen(base());
  const output = applyGridPaste(input, [['X', 'Y'], ['Z', '']], 1, 1, { rowType: 'sizeRow', createKey: () => 'c' });
  assert.deepEqual(output, [row('a', ['A1', 'A2', '']), row('b', ['B1', 'X', 'Y']), row('c', ['', 'Z', ''], { _type: 'sizeRow' })]);
  assert.deepEqual(input, base());
});

test('initial empty table can be filled and new row keys are unique', () => {
  let next = 0;
  assert.deepEqual(applyGridPaste([], [['one'], ['two']], 0, 0, { createKey: () => `new${++next}` }), [row('new1', ['one']), row('new2', ['two'])]);
});

test('edge origin can append a row or a column', () => {
  assert.deepEqual(applyGridPaste(base(), [['C1', 'C2']], 2, 0, { createKey: () => 'c' }), [...base(), row('c', ['C1', 'C2'])]);
  assert.deepEqual(applyGridPaste(base(), [['A3']], 0, 2), [row('a', ['A1', 'A2', 'A3']), row('b', ['B1', 'B2', ''])]);
});

test('parser integration preserves quoted CRLF, empty cells and leading zeros', () => {
  const block = parseClipboard('00123\t"first\r\nsecond"\t\r\n');
  assert.deepEqual(applyGridPaste([], block, 0, 0, { createKey: () => 'a' }), [row('a', ['00123', 'first\r\nsecond', ''])]);
});

test('all pasted rows are data, with no header or formula interpretation', () => {
  assert.deepEqual(applyGridPaste(base(), [['SKU', '=SUM(A1:A2)']], 0, 0), [row('a', ['SKU', '=SUM(A1:A2)']), row('b', ['B1', 'B2'])]);
});

test('empty pasted cells overwrite only cells inside the block', () => {
  assert.deepEqual(applyGridPaste(base(), [['']], 0, 1), [row('a', ['A1', '']), row('b', ['B1', 'B2'])]);
});

test('existing zero-width rows can gain columns', () => {
  assert.deepEqual(applyGridPaste([row('a', []), row('b', [])], [['x']], 1, 0), [row('a', ['']), row('b', ['x'])]);
});

test('invalid or ragged blocks fail without changing the destination', () => {
  const input = frozen(base());
  for (const block of [null, 'x', [], [[]], [['x'], ['y', 'z']], [[1]], [new Array(1)], new Array(1)]) {
    assert.throws(() => applyGridPaste(input, block, 0, 0), TypeError);
    assert.deepEqual(input, base());
  }
});

test('invalid row models and duplicate keys are rejected', () => {
  for (const input of [null, {}, [null], [row('', [''])], [row('a', [1])], [row('a', ['']), row('a', [''])], [row('a', ['']), row('b', [])], [row('a', [''], { _type: '' })], new Array(1)]) {
    assert.throws(() => applyGridPaste(input, [['x']], 0, 0), TypeError);
  }
});

test('origins cannot be negative, fractional or leave gaps beyond the existing grid', () => {
  for (const [r, c] of [[-1, 0], [0, -1], [0.5, 0], [0, NaN], [3, 0], [0, 3]]) {
    assert.throws(() => applyGridPaste(base(), [['x']], r, c), RangeError);
  }
});

test('result bounds include existing rows and the paste offset', () => {
  assert.doesNotThrow(() => applyGridPaste(base(), [['x']], 1, 1, { maxRows: 2, maxColumns: 2 }));
  for (const options of [{ maxRows: 1 }, { maxColumns: 1 }]) {
    assert.throws(() => applyGridPaste(base(), [['x']], 0, 0, options), RangeError);
  }
  assert.throws(() => applyGridPaste(base(), [['x'], ['y']], 1, 0, { maxRows: 2, createKey: () => 'c' }), RangeError);
  assert.throws(() => applyGridPaste(base(), [['x', 'y']], 0, 1, { maxColumns: 2 }), RangeError);
});

test('invalid options are rejected', () => {
  for (const options of [null, [], { maxRows: 0 }, { maxColumns: Infinity }, { maxRows: 1.5 }, { rowType: '' }, { createKey: 'x' }, { maxRow: 10 }]) {
    assert.throws(() => applyGridPaste(base(), [['x']], 0, 0, options), TypeError);
  }
});

test('new keys are required only when rows are created', () => {
  let calls = 0;
  applyGridPaste(base(), [['x']], 0, 0, { createKey: () => { calls++; return 'c'; } });
  assert.equal(calls, 0);
  assert.throws(() => applyGridPaste([], [['x']], 0, 0), TypeError);
});

test('duplicate or invalid generated keys fail without changing existing data', () => {
  const input = frozen(base());
  for (const createKey of [() => 'a', () => '', () => 5, () => 'same']) {
    assert.throws(() => applyGridPaste(input, [['x'], ['y']], 2, 0, { createKey }), TypeError);
    assert.deepEqual(input, base());
  }
});

test('key generation errors leave input rows and paste block unchanged', () => {
  const input = frozen(base());
  const block = Object.freeze([Object.freeze(['x'])]);
  assert.throws(() => applyGridPaste(input, block, 2, 0, { createKey: () => { throw Error('key generator failed'); } }), /key generator failed/);
  assert.deepEqual(input, base());
  assert.deepEqual(block, [['x']]);
});
