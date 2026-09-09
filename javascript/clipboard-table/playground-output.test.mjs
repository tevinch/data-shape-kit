import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlaygroundOutput } from './playground-output.mjs';
import { parseDelimited } from '../markdown-table/index.mjs';

const sample = 'ID\tNote\r\n001\t"a|b\nnext"\r\n';
test('JSON keeps leading zeros and quoted newlines', () => {
  const result = buildPlaygroundOutput(sample, 'json', true);
  assert.deepEqual(JSON.parse(result.content), [{ ID: '001', Note: 'a|b\nnext' }]);
  assert.equal(result.downloadContent, `${result.content}\n`);
  assert.equal(result.fileName, 'clipboard-table.json');
  assert.equal(result.mimeType, 'application/json;charset=utf-8');
  assert.equal(result.label, 'JSON');
});
test('Markdown produces an escaped complete table', () => {
  const result = buildPlaygroundOutput(sample, 'markdown', true);
  assert.equal(result.content, '| ID | Note |\n| --- | --- |\n| 001 | a\\|b<br>next |');
  assert.equal(result.downloadContent, `${result.content}\n`);
  assert.equal(result.fileName, 'clipboard-table.md');
  assert.equal(result.mimeType, 'text/markdown;charset=utf-8');
  assert.equal(result.label, 'Markdown');
});
test('CSV quotes every field and preserves literal field text', () => {
  const result = buildPlaygroundOutput('ID\tNote\tEmpty\r\n001\t"comma, quote ""yes""\nnext"\t', 'csv', true);
  assert.equal(result.content, '"ID","Note","Empty"\r\n"001","comma, quote ""yes""\nnext",""');
  assert.deepEqual(result.rows, [
    ['ID', 'Note', 'Empty'],
    ['001', 'comma, quote "yes"\nnext', ''],
  ]);
  assert.equal(result.fileName, 'clipboard-table.csv');
  assert.equal(result.mimeType, 'text/csv;charset=utf-8');
  assert.equal(result.label, 'CSV');
});
test('CSV headings affect preview only while every ragged and blank row is serialized', () => {
  const input = '\tA\tA\r\n001\t\r\n2\r\n""\r\n';
  const expectedRows = [['', 'A', 'A'], ['001', ''], ['2'], ['']];
  const expectedCsv = '"","A","A"\r\n"001",""\r\n"2"\r\n""';
  const withHeadings = buildPlaygroundOutput(input, 'csv', true);
  const withoutHeadings = buildPlaygroundOutput(input, 'csv', false);

  assert.deepEqual(withHeadings.rows, expectedRows);
  assert.deepEqual(withHeadings.headings, ['', 'A', 'A']);
  assert.deepEqual(withHeadings.data, [['001', ''], ['2'], ['']]);
  assert.deepEqual(withoutHeadings.headings, ['Column 1', 'Column 2', 'Column 3']);
  assert.deepEqual(withoutHeadings.data, expectedRows);
  assert.equal(withHeadings.content, expectedCsv);
  assert.equal(withoutHeadings.content, expectedCsv);
});
test('CSV preview generates headings for data wider than the header row', () => {
  const result = buildPlaygroundOutput('A\tB\r\n1\t2\t3', 'csv', true);
  assert.deepEqual(result.headings, ['A', 'B', 'Column 3']);
  assert.deepEqual(result.data, [['1', '2', '3']]);
  assert.equal(result.content, '"A","B"\r\n"1","2","3"');
});
test('CSV input preserves exact string fields and download parses without an extra row', () => {
  const input = '\uFEFFCode,Long,Missing,Bool,Date,Unicode,Space,Special\r\n'
    + '001,12345678901234567890,NA,true,2026-09-09,雪,"  padded  ",'
    + '"tab\tcomma, cr\r\nline and BOM \uFEFF and ""quote"""\r\n';
  const expectedRows = [
    ['Code', 'Long', 'Missing', 'Bool', 'Date', 'Unicode', 'Space', 'Special'],
    ['001', '12345678901234567890', 'NA', 'true', '2026-09-09', '雪', '  padded  ', 'tab\tcomma, cr\r\nline and BOM \uFEFF and "quote"'],
  ];
  const expectedCsv = '"Code","Long","Missing","Bool","Date","Unicode","Space","Special"\r\n'
    + '"001","12345678901234567890","NA","true","2026-09-09","雪","  padded  ",'
    + '"tab\tcomma, cr\r\nline and BOM \uFEFF and ""quote"""';
  const result = buildPlaygroundOutput(input, 'csv', true, 'csv');

  assert.deepEqual(result.rows, expectedRows);
  assert.equal(result.content, expectedCsv);
  assert.equal(result.downloadContent, `${expectedCsv}\r\n`);
  assert.deepEqual(parseDelimited(result.downloadContent, ','), expectedRows);
});
test('turning headings off retains every input row', () => {
  const result = buildPlaygroundOutput('001\t\n002\tend', 'markdown', false);
  assert.deepEqual(result.headings, ['Column 1', 'Column 2']);
  assert.equal(result.data.length, 2);
  assert.equal(result.content, '| Column 1 | Column 2 |\n| --- | --- |\n| 001 |  |\n| 002 | end |');
});
test('duplicate headings are valid for Markdown but rejected as JSON keys', () => {
  assert.throws(() => buildPlaygroundOutput('A\tA\n1\t2', 'json'), { code: 'DUPLICATE_HEADER' });
  assert.equal(buildPlaygroundOutput('A\tA\n1\t2', 'markdown').content, '| A | A |\n| --- | --- |\n| 1 | 2 |');
});
test('blank headings are kept in Markdown without discarding values', () => {
  assert.equal(buildPlaygroundOutput('\tB\n1\t2', 'markdown').content, '|  | B |\n| --- | --- |\n| 1 | 2 |');
  assert.throws(() => buildPlaygroundOutput('\tB\n1\t2', 'json'), { code: 'EMPTY_HEADER' });
});
test('JSON arrays preserve ragged rows while Markdown rejects them', () => {
  assert.deepEqual(JSON.parse(buildPlaygroundOutput('1\t2\n3', 'json', false).content), [['1', '2'], ['3']]);
  assert.throws(() => buildPlaygroundOutput('1\t2\n3', 'markdown', false), { code: 'RAGGED_ROW' });
});
test('Markdown character limit includes separators and quotes', () => {
  const input = `"${'x'.repeat(99_998)}"\n`;
  assert.throws(() => buildPlaygroundOutput(input, 'markdown', false), { code: 'MAX_CHARS' });
  assert.equal(JSON.parse(buildPlaygroundOutput(input, 'json', false).content)[0][0].length, 99_998);
});
test('Markdown row and column limits do not lower the JSON limits', () => {
  const tall = Array(1001).fill('x').join('\n');
  const wide = Array(65).fill('x').join('\t');
  assert.throws(() => buildPlaygroundOutput(tall, 'markdown', false), { code: 'MAX_ROWS' });
  assert.throws(() => buildPlaygroundOutput(wide, 'markdown', false), { code: 'MAX_COLUMNS' });
  assert.equal(buildPlaygroundOutput(tall, 'json', false).data.length, 1001);
  assert.equal(buildPlaygroundOutput(wide, 'json', false).headings.length, 65);
});
test('exports keep data past the thirty-row visual preview', () => {
  const input = 'ID\n' + Array.from({ length: 35 }, (_, i) => `${i}`).join('\n');
  const result = buildPlaygroundOutput(input, 'markdown');
  assert.equal(result.data.length, 35);
  assert.equal(result.content.split('\n').length, 37);
  assert.ok(result.content.endsWith('| 34 |'));
});
test('empty and BOM-only inputs have no downloadable output', () => {
  for (const input of ['', '\uFEFF']) for (const mode of ['json', 'markdown', 'csv']) {
    assert.equal(buildPlaygroundOutput(input, mode), null);
  }
});
test('an explicit empty cell remains a real data row', () => {
  const result = buildPlaygroundOutput('""', 'markdown', false);
  assert.deepEqual(result.data, [['']]);
  assert.equal(result.content, '| Column 1 |\n| --- |\n|  |');
});
test('invalid output options are rejected', () => {
  assert.throws(() => buildPlaygroundOutput('a', 'html'), TypeError);
  assert.throws(() => buildPlaygroundOutput('a', 'json', 'yes'), TypeError);
});

test('explicit CSV input keeps commas, CRLF, doubled quotes and leading zeros in JSON', () => {
  const input = '\uFEFFID,Note,Empty\r\n001,"a,b\r\nsaid ""yes""",\r\n';
  const result = buildPlaygroundOutput(input, 'json', true, 'csv');
  assert.deepEqual(JSON.parse(result.content), [{ ID: '001', Note: 'a,b\r\nsaid "yes"', Empty: '' }]);
});
test('CSV Markdown escapes literal text and retains blank headings', () => {
  const result = buildPlaygroundOutput(',Note\n001,"a|b\nnext"', 'markdown', true, 'csv');
  assert.equal(result.content, '|  | Note |\n| --- | --- |\n| 001 | a\\|b<br>next |');
});
test('input format is explicit; TSV leaves commas and CSV leaves tabs in cells', () => {
  assert.deepEqual(JSON.parse(buildPlaygroundOutput('a,b\tc', 'json', false).content), [['a,b', 'c']]);
  assert.deepEqual(JSON.parse(buildPlaygroundOutput('a,b\tc', 'json', false, 'csv').content), [['a', 'b\tc']]);
  assert.throws(() => buildPlaygroundOutput('a', 'json', false, 'auto'), TypeError);
});
test('CSV quoting errors expose coordinates without echoing input', () => {
  for (const [input, code] of [['a,"private', 'UNCLOSED_QUOTE'], ['a,"private"x', 'UNEXPECTED_CHARACTER'], ['a,pri"vate', 'UNEXPECTED_QUOTE']]) {
    assert.throws(() => buildPlaygroundOutput(input, 'csv', false, 'csv'), error =>
      error.code === code && error.row === 1 && error.column === 2 && !error.message.includes('private'));
  }
});
test('CSV follows existing JSON header and row-width rules', () => {
  assert.throws(() => buildPlaygroundOutput('A,A\n1,2', 'json', true, 'csv'), { code: 'DUPLICATE_HEADER' });
  assert.throws(() => buildPlaygroundOutput(',B\n1,2', 'json', true, 'csv'), { code: 'EMPTY_HEADER' });
  assert.throws(() => buildPlaygroundOutput('A,B\n1', 'json', true, 'csv'), { code: 'RAGGED_ROW' });
  assert.deepEqual(JSON.parse(buildPlaygroundOutput('A,B\n1', 'json', false, 'csv').content), [['A', 'B'], ['1']]);
  assert.throws(() => buildPlaygroundOutput('A,B\n1', 'markdown', false, 'csv'), { code: 'RAGGED_ROW' });
});
test('CSV output uses JSON-sized limits, including raw separators and quotes', () => {
  for (const [input, code] of [
    [`"${'x'.repeat(99_998)}"\n`, 'MAX_CHARS'],
    [Array(1001).fill('x').join('\n'), 'MAX_ROWS'],
    [Array(65).fill('x').join(','), 'MAX_COLUMNS'],
  ]) {
    assert.throws(() => buildPlaygroundOutput(input, 'markdown', false, 'csv'), { code });
    assert.ok(buildPlaygroundOutput(input, 'csv', false, 'csv').content);
  }
  for (const [input, code] of [
    ['x'.repeat(1_000_001), 'MAX_CHARS'],
    [Array(10_001).fill('x').join('\n'), 'MAX_ROWS'],
    [Array(257).fill('x').join(','), 'MAX_COLUMNS'],
  ]) assert.throws(() => buildPlaygroundOutput(input, 'csv', false, 'csv'), { code });
});
test('CSV empty input and additional final blank records stay distinct', () => {
  for (const input of ['', '\uFEFF']) assert.equal(buildPlaygroundOutput(input, 'csv', false, 'csv'), null);
  const result = buildPlaygroundOutput('""\r\n\r\n', 'csv', false, 'csv');
  assert.deepEqual(result.rows, [[''], ['']]);
  assert.equal(result.content, '""\r\n""');
  assert.equal(result.downloadContent, '""\r\n""\r\n');
  assert.deepEqual(parseDelimited(result.downloadContent, ','), [[''], ['']]);
});
