import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlaygroundOutput } from './playground-output.mjs';

const sample = 'ID\tNote\r\n001\t"a|b\nnext"\r\n';
test('JSON keeps leading zeros and quoted newlines', () => {
  const result = buildPlaygroundOutput(sample, 'json', true);
  assert.deepEqual(JSON.parse(result.content), [{ ID: '001', Note: 'a|b\nnext' }]);
  assert.equal(result.fileName, 'clipboard-table.json');
  assert.equal(result.mimeType, 'application/json;charset=utf-8');
});
test('Markdown produces an escaped complete table', () => {
  const result = buildPlaygroundOutput(sample, 'markdown', true);
  assert.equal(result.content, '| ID | Note |\n| --- | --- |\n| 001 | a\\|b<br>next |');
  assert.equal(result.fileName, 'clipboard-table.md');
  assert.equal(result.mimeType, 'text/markdown;charset=utf-8');
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
  for (const input of ['', '\uFEFF']) for (const mode of ['json', 'markdown']) {
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
    assert.throws(() => buildPlaygroundOutput(input, 'json', false, 'csv'), error =>
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
test('CSV uses unchanged output limits, including raw separators and quotes', () => {
  for (const [input, code] of [
    [`"${'x'.repeat(99_998)}"\n`, 'MAX_CHARS'],
    [Array(1001).fill('x').join('\n'), 'MAX_ROWS'],
    [Array(65).fill('x').join(','), 'MAX_COLUMNS'],
  ]) {
    assert.throws(() => buildPlaygroundOutput(input, 'markdown', false, 'csv'), { code });
    assert.ok(buildPlaygroundOutput(input, 'json', false, 'csv').content);
  }
  for (const [input, code] of [
    ['x'.repeat(1_000_001), 'MAX_CHARS'],
    [Array(10_001).fill('x').join('\n'), 'MAX_ROWS'],
    [Array(257).fill('x').join(','), 'MAX_COLUMNS'],
  ]) assert.throws(() => buildPlaygroundOutput(input, 'json', false, 'csv'), { code });
});
test('CSV empty input and additional final blank records stay distinct', () => {
  for (const input of ['', '\uFEFF']) assert.equal(buildPlaygroundOutput(input, 'json', false, 'csv'), null);
  assert.deepEqual(JSON.parse(buildPlaygroundOutput('""\r\n\r\n', 'json', false, 'csv').content), [[''], ['']]);
});
