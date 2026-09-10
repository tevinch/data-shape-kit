import assert from 'node:assert/strict';
import test from 'node:test';

import { appendTag, commitTagEdit } from '../tag-edits.mjs';

test('renames a tag without changing its identity, peers, or input', () => {
  const original = [
    { id: 'a', text: 'Import guid' },
    { id: 'b', text: 'CSV checks' },
  ];

  const result = commitTagEdit(original, {
    id: 'a',
    originalText: 'Import guid',
    draft: ' Import guide ',
  });

  assert.equal(result.ok, true);
  assert.equal(result.value[0].id, 'a');
  assert.equal(result.value[0].text, 'Import guide');
  assert.equal(result.value[1], original[1]);
  assert.equal(original[0].text, 'Import guid');
});

test('preserves extra fields on the renamed tag', () => {
  const original = [
    { id: 'a', text: 'Import guid', color: 'blue' },
    { id: 'b', text: 'CSV checks' },
  ];

  const result = commitTagEdit(original, {
    id: 'a',
    originalText: 'Import guid',
    draft: 'Import guide',
  });

  assert.deepEqual(result, {
    ok: true,
    value: [
      { id: 'a', text: 'Import guide', color: 'blue' },
      original[1],
    ],
    changed: true,
  });
});

test('returns the original array for a trimmed no-op', () => {
  const original = [{ id: 'a', text: 'Import guide' }];

  const result = commitTagEdit(original, {
    id: 'a',
    originalText: 'Import guide',
    draft: '  Import guide  ',
  });

  assert.deepEqual(result, { ok: true, value: original, changed: false });
  assert.equal(result.value, original);
});

test('rejects a blank edited tag', () => {
  const result = commitTagEdit([{ id: 'a', text: 'Import guide' }], {
    id: 'a',
    originalText: 'Import guide',
    draft: ' \n\t ',
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'blank');
  assert.match(result.message, /enter a tag/i);
});

test('rejects a case-insensitive trimmed duplicate', () => {
  const result = commitTagEdit(
    [
      { id: 'a', text: 'Import guid' },
      { id: 'b', text: ' CSV checks ' },
    ],
    { id: 'a', originalText: 'Import guid', draft: ' csv CHECKS ' },
  );

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'duplicate');
  assert.match(result.message, /already exists/i);
});

test('rejects a no-op when another tag already has the same label', () => {
  const result = commitTagEdit(
    [
      { id: 'a', text: 'Repeated' },
      { id: 'b', text: ' repeated ' },
    ],
    { id: 'a', originalText: 'Repeated', draft: 'Repeated' },
  );

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'duplicate');
});

test('reports a missing edit target', () => {
  const result = commitTagEdit([{ id: 'b', text: 'CSV checks' }], {
    id: 'a',
    originalText: 'Import guid',
    draft: 'Import guide',
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'missing');
  assert.match(result.message, /cancel.*reopen/i);
});

test('reports an external change conflict before validating the draft', () => {
  const result = commitTagEdit([{ id: 'a', text: 'Changed elsewhere' }], {
    id: 'a',
    originalText: 'Import guid',
    draft: ' ',
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'conflict');
  assert.match(result.message, /cancel.*reopen/i);
});

test('preserves an unrelated external update while editing', () => {
  const current = [
    { id: 'a', text: 'Import guid' },
    { id: 'b', text: 'Updated externally' },
  ];

  const result = commitTagEdit(current, {
    id: 'a',
    originalText: 'Import guid',
    draft: 'Import guide',
  });

  assert.equal(result.ok, true);
  assert.equal(result.value[1], current[1]);
  assert.equal(result.value[1].text, 'Updated externally');
});

test('appends one trimmed tag without mutating the input', () => {
  const original = [{ id: 'a', text: 'Import guide' }];

  const result = appendTag(original, 'b', ' CSV checks ');

  assert.deepEqual(result, {
    ok: true,
    value: [original[0], { id: 'b', text: 'CSV checks' }],
    changed: true,
  });
  assert.equal(original.length, 1);
});

test('rejects an append with a reused ID before text checks', () => {
  const result = appendTag([{ id: 'a', text: 'Import guide' }], 'a', ' ');

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'duplicate-id');
  assert.match(result.message, /identifier/i);
});

test('rejects blank and duplicate appended text', () => {
  const original = [{ id: 'a', text: 'Import guide' }];

  assert.equal(appendTag(original, 'b', '  ').reason, 'blank');
  assert.equal(appendTag(original, 'b', ' import GUIDE ').reason, 'duplicate');
});

test('keeps Unicode and HTML-like text as literal strings', () => {
  const result = appendTag([], 'markup', ' <b>Café</b> ☕ ');

  assert.deepEqual(result, {
    ok: true,
    value: [{ id: 'markup', text: '<b>Café</b> ☕' }],
    changed: true,
  });
});

test('rejects malformed tag collections', () => {
  const edit = { id: 'a', originalText: 'A', draft: 'B' };

  assert.throws(() => commitTagEdit(null, edit), TypeError);
  assert.throws(() => commitTagEdit({}, edit), TypeError);
  assert.throws(() => commitTagEdit([null], edit), TypeError);
  assert.throws(() => commitTagEdit([{ id: '', text: 'A' }], edit), TypeError);
  assert.throws(() => commitTagEdit([{ id: 'a', text: 1 }], edit), TypeError);
  assert.throws(
    () =>
      commitTagEdit(
        [
          { id: 'a', text: 'A' },
          { id: 'a', text: 'B' },
        ],
        edit,
      ),
    TypeError,
  );
});

test('rejects malformed edit arguments', () => {
  const value = [{ id: 'a', text: 'A' }];

  assert.throws(() => commitTagEdit(value, null), TypeError);
  assert.throws(
    () => commitTagEdit(value, { id: '', originalText: 'A', draft: 'B' }),
    TypeError,
  );
  assert.throws(
    () => commitTagEdit(value, { id: 'a', originalText: 1, draft: 'B' }),
    TypeError,
  );
  assert.throws(
    () => commitTagEdit(value, { id: 'a', originalText: 'A', draft: 1 }),
    TypeError,
  );
});

test('rejects malformed append arguments', () => {
  const value = [{ id: 'a', text: 'A' }];

  assert.throws(() => appendTag(value, '', 'B'), TypeError);
  assert.throws(() => appendTag(value, 1, 'B'), TypeError);
  assert.throws(() => appendTag(value, 'b', null), TypeError);
});
