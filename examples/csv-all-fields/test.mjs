import assert from 'node:assert/strict';
import { test } from 'node:test';
import Papa from 'papaparse';

// The baseline exercises the documented first-record schema directly.
const exportCsv = process.env.CSV_SCHEMA_BASELINE
  ? Papa.unparse
  : (await import('./recipe.mjs')).exportCsv;
const read = (csv, options = {}) => {
  const result = Papa.parse(csv, { delimiter: ',', ...options });
  assert.deepEqual(result.errors, []);
  return result.data;
};

test('later optional field survives CSV export and parsing', () => {
  const rows = [{ a: 1, b: 2 }, { a: 3, b: 4, c: 5 }];
  const csv = exportCsv(rows);
  assert.equal(csv, 'a,b,c\r\n1,2,\r\n3,4,5');
  assert.deepEqual(read(csv), [['a', 'b', 'c'], ['1', '2', ''], ['3', '4', '5']]);
});

test('an empty first record still permits later fields and quoted text', () => {
  const rows = [{}, { id: '0012', note: 'a,"b"\nnext' }, { later: false, id: 'NA', note: null }];
  const csv = exportCsv(rows);
  assert.deepEqual(read(csv), [
    ['id', 'note', 'later'], ['', '', ''],
    ['0012', 'a,"b"\nnext', ''], ['NA', '', 'false']
  ]);
});

test('empty input and records without fields produce an empty result', () => {
  assert.equal(exportCsv([]), '');
  assert.equal(exportCsv([{}, {}]), '');
});

test('delimiter, newline, quoting and original data remain intact', () => {
  const rows = Object.freeze([Object.freeze({ a: 'first' }), Object.freeze({ a: 'next', b: 'extra' })]);
  const options = Object.freeze({ delimiter: ';', newline: '\n', quotes: true });
  const csv = exportCsv(rows, options);
  assert.equal(csv, '"a";"b"\n"first";\n"next";"extra"');
  assert.deepEqual(read(csv, { delimiter: ';' }), [['a', 'b'], ['first', ''], ['next', 'extra']]);
  assert.deepEqual(rows, [{ a: 'first' }, { a: 'next', b: 'extra' }]);
  assert.deepEqual(options, { delimiter: ';', newline: '\n', quotes: true });
});

test('header false keeps the complete field order without a header', () => {
  assert.equal(exportCsv([{ a: 'one' }, { b: 'two' }], { header: false }), 'one,\r\n,two');
});

test('an explicit column selection continues to restrict the export', () => {
  const rows = [{ a: 'public', b: 'chosen' }, { a: 'later', b: 'second', c: 'excluded' }];
  assert.equal(exportCsv(rows, { columns: ['b'] }), 'b\r\nchosen\r\nsecond');
  assert.throws(() => exportCsv(rows, { columns: [] }), /Option columns is empty/);
});

test('existing empty-row and formula-escaping settings remain effective', () => {
  const csv = exportCsv([{}, { a: '=1+2', b: 'kept' }], { skipEmptyLines: 'greedy', escapeFormulae: true });
  assert.deepEqual(read(csv), [['a', 'b'], ["'=1+2", 'kept']]);
});

test('a missing own field remains empty when its name exists on the prototype', () => {
  const rows = [{ id: 'first' }, { id: 'second', constructor: 'literal', toString: 'text' }];
  assert.deepEqual(read(exportCsv(rows)), [
    ['id', 'constructor', 'toString'], ['first', '', ''], ['second', 'literal', 'text']
  ]);
});

test('skipEmptyLines true continues to skip completely empty records', () => {
  const rows = [{ a: 'one', b: 'two' }, {}, { a: 'three', b: 'four' }];
  assert.equal(exportCsv(rows, { skipEmptyLines: true }), 'a,b\r\none,two\r\nthree,four');
});
