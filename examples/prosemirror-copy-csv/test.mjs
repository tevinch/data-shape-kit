// Copyright (c) 2026 Tevinch. SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { Schema } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import { CellSelection, TableMap, tableNodes } from '@tiptap/pm/tables';
import { selectionToCsv, SelectionCsvError } from './selection-csv.mjs';

const schema = new Schema({ nodes: {
  doc: { content: 'block+' },
  paragraph: { group: 'block', content: 'inline*', toDOM: () => ['p', 0] },
  text: { group: 'inline' },
  hard_break: { group: 'inline', inline: true, toDOM: () => ['br'] },
  image: { group: 'inline', inline: true, atom: true, attrs: { alt: { default: '' } }, toDOM: () => ['img'] },
  ...tableNodes({ tableGroup: 'block', cellContent: 'block+' }),
} });
const paragraph = text => schema.nodes.paragraph.create(null, text ? schema.text(text) : null);
const cell = (text, attrs, header = false) => schema.nodes[header ? 'table_header' : 'table_cell'].create(attrs, paragraph(text));
function fixture(rows, from = [0, 0], to = from) {
  const table = schema.nodes.table.create(null, rows.map(row => schema.nodes.table_row.create(null, row.map(value => typeof value === 'string' ? cell(value) : value))));
  const prefix = paragraph('Before table');
  const doc = schema.nodes.doc.create(null, [prefix, table, paragraph('After table')]);
  const map = TableMap.get(table), start = prefix.nodeSize + 1;
  const pos = ([row, col]) => start + map.map[row * map.width + col];
  return { table, doc, selection: CellSelection.create(doc, pos(from), pos(to)) };
}
const error = (code, row, column) => value => value instanceof SelectionCsvError && value.code === code && (row === undefined || value.row === row) && (column === undefined || value.column === column);

test('copies precisely the requested body rectangle in row and column order', () => {
  const { selection } = fixture([['Name', 'Age', 'City'], ['Alice', '32', 'Berlin'], ['Bob', '28', 'Paris'], ['Carol', '41', 'Rome']], [1, 1], [2, 2]);
  assert.equal(selectionToCsv(selection), '32,Berlin\r\n28,Paris');
});
test('reverse selection direction produces the same order', () => {
  assert.equal(selectionToCsv(fixture([['A', 'B'], ['C', 'D']], [1, 1], [0, 0]).selection), 'A,B\r\nC,D');
});
test('includes a header only when it is selected', () => {
  assert.equal(selectionToCsv(fixture([[cell('Name', null, true)], ['Alice']], [0, 0], [1, 0]).selection), 'Name\r\nAlice');
});
test('preserves zero-prefixed text, spaces, tabs and Unicode', () => {
  assert.equal(selectionToCsv(fixture([['0012', ' x\t ', '小明😀']], [0, 0], [0, 2]).selection), '0012, x\t ,小明😀');
});
test('quotes commas, quotes and all line ending forms', () => {
  const rows = [['a,b', 'say "hi"', 'a\nb', 'c\rd', 'e\r\nf']];
  assert.equal(selectionToCsv(fixture(rows, [0, 0], [0, 4]).selection), '"a,b","say ""hi""","a\nb","c\rd","e\r\nf"');
});
test('an empty selected cell remains one explicit CSV cell', () => {
  assert.equal(selectionToCsv(fixture([['']]).selection), '""');
});
test('preserves empty rows and trailing cells', () => {
  assert.equal(selectionToCsv(fixture([['A', ''], ['', '']], [0, 0], [1, 1]).selection), 'A,""\r\n"",""');
});
test('keeps paragraph and hard-break boundaries inside one quoted CSV cell', () => {
  const rich = schema.nodes.table_cell.create(null, [schema.nodes.paragraph.create(null, [schema.text('A'), schema.nodes.hard_break.create(), schema.text('B')]), paragraph('C')]);
  assert.equal(selectionToCsv(fixture([[rich]]).selection), '"A\nB\nC"');
});
test('colspan text occurs once with an empty covered position', () => {
  assert.equal(selectionToCsv(fixture([[cell('wide', { colspan: 2 }), 'C'], ['A', 'B', 'D']], [0, 0], [1, 2]).selection), 'wide,"",C\r\nA,B,D');
});
test('rowspan text occurs once with an empty covered position', () => {
  assert.equal(selectionToCsv(fixture([[cell('tall', { rowspan: 2 }), 'B'], ['C']], [0, 0], [1, 1]).selection), 'tall,B\r\n"",C');
});
test('does not pull text from a merged cell whose origin is outside the rectangle', () => {
  const rows = [['A', cell('outside', { rowspan: 3 }), 'C'], ['B', 'D'], ['E', 'F']];
  assert.equal(selectionToCsv(fixture(rows, [1, 0], [2, 2]).selection), 'B,"",D\r\nE,"",F');
});
test('leaves a regular text selection alone', () => {
  const { doc } = fixture([['A']]);
  assert.equal(selectionToCsv(TextSelection.create(doc, 1)), undefined);
});
test('refuses malformed table geometry instead of silently filling a missing cell', () => {
  const { selection } = fixture([['A', 'B'], ['C']], [0, 0], [0, 1]);
  assert.throws(() => selectionToCsv(selection), error('MALFORMED_TABLE'));
});
test('refuses embedded content without a caller-provided text serializer', () => {
  const imageCell = schema.nodes.table_cell.create(null, schema.nodes.paragraph.create(null, schema.nodes.image.create({ alt: 'example' })));
  assert.throws(() => selectionToCsv(fixture([[imageCell]]).selection), error('UNSUPPORTED_CONTENT', 1, 1));
});
test('caller can explicitly serialize custom content and receives selected cell coordinates', () => {
  const calls = [];
  const result = selectionToCsv(fixture([['A', 'B'], ['C', 'D']], [1, 0], [1, 1]).selection, { readCell: (node, coordinate) => { calls.push(coordinate); return node.textContent.toLowerCase(); } });
  assert.equal(result, 'c,d');
  assert.deepEqual(calls, [{ row: 1, column: 1 }, { row: 1, column: 2 }]);
});
test('rejects invalid options and non-string serializer output', () => {
  const { selection } = fixture([['A']]);
  for (const options of [null, [], { unused: true }, { readCell: 7 }]) assert.throws(() => selectionToCsv(selection, options), TypeError);
  assert.throws(() => selectionToCsv(selection, { readCell: () => 12 }), TypeError);
});
test('accepts exactly 1000 selected rows and refuses 1001', () => {
  const ok = fixture(Array.from({ length: 1000 }, () => ['x']), [0, 0], [999, 0]);
  assert.equal(selectionToCsv(ok.selection).split('\r\n').length, 1000);
  const over = fixture(Array.from({ length: 1001 }, () => ['x']), [0, 0], [1000, 0]);
  assert.throws(() => selectionToCsv(over.selection), error('MAX_ROWS'));
});
test('accepts 64 selected columns and refuses 65', () => {
  assert.equal(selectionToCsv(fixture([Array(64).fill('x')], [0, 0], [0, 63]).selection).split(',').length, 64);
  assert.throws(() => selectionToCsv(fixture([Array(65).fill('x')], [0, 0], [0, 64]).selection), error('MAX_COLUMNS'));
});
test('bounds serialized output including doubled quotes and separators', () => {
  assert.equal(selectionToCsv(fixture([['a'.repeat(100_000)]]).selection).length, 100_000);
  assert.throws(() => selectionToCsv(fixture([['a'.repeat(100_001)]]).selection), error('MAX_CHARS'));
  assert.throws(() => selectionToCsv(fixture([['"'.repeat(60_000)]]).selection), error('MAX_CHARS'));
});
test('does not modify the document or treat formula-like text as executable', () => {
  const { doc, selection } = fixture([['=1+1', '001']], [0, 0], [0, 1]);
  const before = doc.toJSON();
  assert.equal(selectionToCsv(selection), '=1+1,001');
  assert.deepEqual(doc.toJSON(), before);
});
