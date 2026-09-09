// Copyright (c) 2026 Tevinch. SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDelimited, formatMarkdown, buildMarkdownTable, TableTextError } from './index.mjs';

test('CSV quotes, commas, doubled quotes and multiline strings', () => {
  assert.deepEqual(parseDelimited('name,note\r\n"Last, First","said ""yes""\r\nthen left"\r\n', ','),
    [['name', 'note'], ['Last, First', 'said "yes"\r\nthen left']]);
});
test('spreadsheet tabs, leading zeros, Unicode and empty cells remain strings', () => {
  assert.deepEqual(parseDelimited('id\t名字\tvalue\n001\t小明\t\n002\t"a\tb"\t-0.00', '\t'),
    [['id', '名字', 'value'], ['001', '小明', ''], ['002', 'a\tb', '-0.00']]);
});
test('one initial BOM and one final record separator are structural', () => {
  assert.deepEqual(parseDelimited('\uFEFFa,b\n', ','), [['a', 'b']]);
  assert.deepEqual(parseDelimited('a\n\n', ','), [['a'], ['']]);
  assert.deepEqual(parseDelimited('"\uFEFFa",b', ','), [['\uFEFFa', 'b']]);
  assert.deepEqual(parseDelimited('', ','), []);
  assert.deepEqual(parseDelimited('\uFEFF', ','), []);
  assert.deepEqual(parseDelimited('""', ','), [['']]);
});
test('malformed CSV has structural coordinates without echoing data', () => {
  for (const source of ['a,"private', 'a,"private"x', 'a,pri"vate']) {
    assert.throws(() => parseDelimited(source, ','), e =>
      e instanceof TableTextError && e.row === 1 && e.column === 2 && !e.message.includes('private'));
  }
});
test('delimiter must be explicit comma or tab', () => {
  for (const delimiter of [undefined, ';', '||', null]) assert.throws(() => parseDelimited('a,b', delimiter), TypeError);
  assert.deepEqual(parseDelimited('a,b', '\t'), [['a,b']]);
});
test('input, row and column limits reject rather than truncate', () => {
  assert.equal(parseDelimited('x'.repeat(100_000), ',')[0][0].length, 100_000);
  assert.throws(() => parseDelimited('x'.repeat(100_001), ','), /MAX_CHARS/);
  assert.equal(parseDelimited(Array(1000).fill('x').join('\n'), ',').length, 1000);
  assert.throws(() => parseDelimited(Array(1001).fill('x').join('\n'), ','), /MAX_ROWS/);
  assert.equal(parseDelimited(Array(64).fill('x').join(','), ',')[0].length, 64);
  assert.throws(() => parseDelimited(Array(65).fill('x').join(','), ','), /MAX_COLUMNS/);
});
test('header row and per-column alignments generate GFM delimiters', () => {
  assert.equal(formatMarkdown([['ID', 'Name', 'Qty', 'Note'], ['001', 'Ada', '2', 'ok']],
    { firstRowHeaders: true, alignments: ['none', 'left', 'right', 'center'] }).markdown,
  '| ID | Name | Qty | Note |\n| --- | :--- | ---: | :---: |\n| 001 | Ada | 2 | ok |');
});
test('headerless input gets generated column names without losing first row', () => {
  const r = buildMarkdownTable('001,2\n003,4', { delimiter: ',', firstRowHeaders: false });
  assert.deepEqual(r.headers, ['Column 1', 'Column 2']);
  assert.deepEqual(r.rows, [['001', '2'], ['003', '4']]);
  assert.equal(r.markdown, '| Column 1 | Column 2 |\n| --- | --- |\n| 001 | 2 |\n| 003 | 4 |');
});
test('empty input emits nothing and header-only input keeps a valid table', () => {
  assert.deepEqual(formatMarkdown([]), { headers: [], rows: [], markdown: '' });
  assert.equal(formatMarkdown([['Title']]).markdown, '| Title |\n| --- |');
  assert.equal(formatMarkdown([['', ''], ['a', 'b']]).headers.length, 2);
  assert.deepEqual(formatMarkdown([['x', 'x']]).headers, ['x', 'x']);
});
test('ragged rows fail visibly', () => {
  assert.throws(() => buildMarkdownTable('a,b\nc', { delimiter: ',' }), e =>
    e instanceof TableTextError && e.code === 'RAGGED_ROW' && e.row === 2);
});
test('literal Markdown, pipes, HTML and entities are escaped', () => {
  const output = formatMarkdown([['Header'], ['a|b\\c *bold* <img> &copy; [x](url) `code` $2']]).markdown;
  assert.equal(output, '| Header |\n| --- |\n| a\\|b\\\\c \\*bold\\* &lt;img&gt; &amp;copy\\; \\[x\\]\\(url\\) \\`code\\` \\$2 |');
});
test('all line endings inside cells become explicit line breaks', () => {
  assert.equal(formatMarkdown([['h'], ['a\r\nb\rc\nd']]).markdown, '| h |\n| --- |\n| a<br>b<br>c<br>d |');
});
test('Unicode line and paragraph separators stay inside their cells', () => {
  assert.equal(formatMarkdown([['h'], ['a\u2028b\u2029c'], ['next']]).markdown,
    '| h |\n| --- |\n| a&#8232;b&#8233;c |\n| next |');
});
test('formatting does not mutate callers', () => {
  const h = Object.freeze(['h']); const r = Object.freeze(['001']);
  const source = Object.freeze([h, r]);
  const result = formatMarkdown(source);
  result.headers[0] = 'other'; result.rows[0][0] = 'other';
  assert.equal(h[0], 'h'); assert.equal(r[0], '001');
});
test('public options and matrix data are validated', () => {
  for (const rows of [null, [['a'], [4]], [[]], [new Array(1)]]) assert.throws(() => formatMarkdown(rows), TypeError);
  assert.throws(() => formatMarkdown([['a']], { firstRowHeaders: 'yes' }), TypeError);
  assert.throws(() => formatMarkdown([['a']], { alignments: ['middle'] }), TypeError);
  assert.throws(() => formatMarkdown([['a']], { alignments: ['left', 'right'] }), TypeError);
});
test('formatted matrix uses the same size bounds as pasted text', () => {
  assert.throws(() => formatMarkdown([['x'.repeat(100_001)]]), /MAX_CHARS/);
  assert.throws(() => formatMarkdown(Array.from({ length: 1001 }, () => ['x'])), /MAX_ROWS/);
  assert.throws(() => formatMarkdown([Array(65).fill('x')]), /MAX_COLUMNS/);
});

test('parser limit overrides reject at the chosen boundary without changing defaults', () => {
  const limits = Object.freeze({ maxChars: 7, maxRows: 2, maxColumns: 2 });
  assert.deepEqual(parseDelimited('a,b\nc,d', ',', limits), [['a', 'b'], ['c', 'd']]);
  assert.throws(() => parseDelimited('a,b\nc,dd', ',', limits), { code: 'MAX_CHARS' });
  assert.throws(() => parseDelimited('a\nb\nc', ',', limits), { code: 'MAX_ROWS' });
  assert.throws(() => parseDelimited('a,b,c', ',', limits), { code: 'MAX_COLUMNS' });
  assert.equal(parseDelimited('a,b,c', ',')[0].length, 3);
});
test('parser can serve larger JSON limits while Markdown formatting remains bounded', () => {
  const input = Array(65).fill('x').join(',');
  const rows = parseDelimited(input, ',', { maxColumns: 256 });
  assert.equal(rows[0].length, 65);
  assert.throws(() => formatMarkdown(rows), { code: 'MAX_COLUMNS' });
  assert.throws(() => parseDelimited(input, ','), { code: 'MAX_COLUMNS' });
});
test('invalid parser limits cannot disable bounds', () => {
  for (const limits of [null, [], 1, { maxRows: 0 }, { maxColumns: -1 }, { maxChars: 1.5 }, { maxRows: Infinity }, { maxChars: Number.MAX_SAFE_INTEGER + 1 }, { unknown: 1 }, { maxChars: undefined }]) {
    assert.throws(() => parseDelimited('x', ',', limits), TypeError);
  }
});
