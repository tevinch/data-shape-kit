import assert from 'node:assert/strict';
import test from 'node:test';

import { highlightTextItems } from '../highlight-text.mjs';

test('maps one phrase across text items, marked content, and an explicit line end', () => {
  const result = highlightTextItems(
    [
      { str: 'A sha' },
      { type: 'beginMarkedContent' },
      { str: 'red ', hasEOL: true },
      { str: 'sentence' },
    ],
    ['A shared sentence'],
  );

  assert.equal(result.text, 'A shared sentence');
  assert.equal(result.matches.length, 1);
  assert.deepEqual(result.matches[0].segments, [
    { itemIndex: 0, start: 0, end: 5 },
    { itemIndex: 2, start: 0, end: 4 },
    { itemIndex: 3, start: 0, end: 8 },
  ]);
});

test('does not invent spaces at item boundaries and maps a phrase across more than three items', () => {
  const result = highlightTextItems(
    [
      { str: 'A ' },
      { str: 'sha' },
      { str: 'red ' },
      { str: 'sent' },
      { str: 'ence', hasEOL: true },
      { str: 'can cross' },
    ],
    ['shared sentence can'],
  );

  assert.equal(result.text, 'A shared sentence can cross');
  assert.deepEqual(result.matches[0].segments, [
    { itemIndex: 1, start: 0, end: 3 },
    { itemIndex: 2, start: 0, end: 4 },
    { itemIndex: 3, start: 0, end: 4 },
    { itemIndex: 4, start: 0, end: 4 },
    { itemIndex: 5, start: 0, end: 3 },
  ]);
});

test('folds source and query whitespace without trimming the indexed page text', () => {
  const result = highlightTextItems(
    [{ str: '  one\t' }, { str: '\n two', hasEOL: true }, { str: ' three  ' }],
    ['\tone\n two   three\r'],
  );

  assert.equal(result.text, ' one two three ');
  assert.deepEqual(result.matches.map(({ start, end }) => [start, end]), [[1, 14]]);
});

test('preserves empty and marked-content indices when identical item strings repeat', () => {
  const items = [
    { str: 'same' },
    { str: '' },
    { type: 'beginMarkedContent', id: 'tag' },
    { str: ' same' },
    { type: 'endMarkedContent' },
  ];
  const result = highlightTextItems(items, ['same']);

  assert.deepEqual(result.matches.map((match) => match.segments), [
    [{ itemIndex: 0, start: 0, end: 4 }],
    [{ itemIndex: 3, start: 1, end: 5 }],
  ]);
  assert.equal(result.html.length, items.length);
  assert.equal(result.html[1], '');
  assert.equal(result.html[2], '');
  assert.equal(result.html[4], '');
});

test('returns overlapping occurrences in query order and merges render spans', () => {
  const result = highlightTextItems([{ str: 'banana' }], ['ana', 'nan']);

  assert.deepEqual(result.matches.map(({ queryIndex, start, end }) => ({ queryIndex, start, end })), [
    { queryIndex: 0, start: 1, end: 4 },
    { queryIndex: 0, start: 3, end: 6 },
    { queryIndex: 1, start: 2, end: 5 },
  ]);
  assert.equal(result.html[0], 'b<mark>anana</mark>');
});

test('matches regex metacharacters literally and escapes all source HTML characters', () => {
  const source = 'Invoice A+B (draft) & <review> "quoted" \'single\'';
  const result = highlightTextItems([{ str: source }], ['A+B (draft) & <review>']);

  assert.equal(result.matches.length, 1);
  assert.equal(
    result.html[0],
    'Invoice <mark>A+B (draft) &amp; &lt;review&gt;</mark> &quot;quoted&quot; &#39;single&#39;',
  );
});

test('returns no matches for empty, whitespace-only, or cleared query lists', () => {
  for (const queries of [[], [''], [' \n\t ']]) {
    const result = highlightTextItems([{ str: '<plain>' }], queries);
    assert.deepEqual(result.matches, []);
    assert.deepEqual(result.html, ['&lt;plain&gt;']);
  }
  assert.deepEqual(highlightTextItems([{ type: 'beginMarkedContent' }], ['anything']), {
    text: '',
    matches: [],
    html: [''],
  });
});

test('maps lowercase expansion and surrogate-pair hits to original UTF-16 offsets', () => {
  const expansion = highlightTextItems([{ str: 'XİY' }], ['i\u0307']);
  assert.deepEqual(expansion.matches[0], {
    queryIndex: 0,
    start: 1,
    end: 2,
    segments: [{ itemIndex: 0, start: 1, end: 2 }],
  });
  assert.equal(expansion.html[0], 'X<mark>İ</mark>Y');

  const surrogate = highlightTextItems([{ str: 'A😀B' }], ['😀'], { caseSensitive: true });
  assert.deepEqual(surrogate.matches[0], {
    queryIndex: 0,
    start: 1,
    end: 3,
    segments: [{ itemIndex: 0, start: 1, end: 3 }],
  });
});

test('supports explicit case sensitivity while preserving original source text', () => {
  const items = Object.freeze([Object.freeze({ str: 'Alpha alpha' })]);
  const insensitive = highlightTextItems(items, ['ALPHA']);
  const sensitive = highlightTextItems(items, ['ALPHA'], { caseSensitive: true });

  assert.equal(insensitive.text, 'Alpha alpha');
  assert.equal(insensitive.matches.length, 2);
  assert.equal(sensitive.matches.length, 0);
  assert.deepEqual(items, [{ str: 'Alpha alpha' }]);
});

test('rejects malformed arrays, items, queries, and options without coercion', () => {
  const invalidCalls = [
    () => highlightTextItems(null, []),
    () => highlightTextItems([], null),
    () => highlightTextItems([null], []),
    () => highlightTextItems([{ str: 42 }], []),
    () => highlightTextItems([{ str: 'x', hasEOL: 'yes' }], []),
    () => highlightTextItems([{ type: 42 }], []),
    () => highlightTextItems([{ type: 'beginMarkedContent', id: 42 }], []),
    () => highlightTextItems([], [42]),
    () => highlightTextItems([], [], null),
    () => highlightTextItems([], [], { caseSensitive: 'yes' }),
  ];

  for (const call of invalidCalls) assert.throws(call, TypeError);
});
