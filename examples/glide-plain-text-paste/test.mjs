// Copyright (c) 2026 Tevinch. SPDX-License-Identifier: MIT
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPlainTextPaste } from './paste-event.mjs';

function event(text, options = {}) {
  const state = { prevented: 0, stopped: 0, reads: [] };
  const target = { nodeType: 1, isContentEditable: false, closest: () => null };
  return {
    state, target, cancelable: true, defaultPrevented: false,
    clipboardData: { types: ['text/plain', 'text/html'], getData(type) { state.reads.push(type); return type === 'text/plain' ? text : '<table><tr><td>old value</td></tr></table>'; } },
    preventDefault() { state.prevented++; }, stopPropagation() { state.stopped++; },
    ...options,
  };
}

test('reads event plain text once, preserves strings, and consumes one paste', () => {
  const e = event('001\tnew value\r\n002\t=literal\r\n');
  const target = [2, 3];
  assert.deepEqual(readPlainTextPaste(e, target), { target: [2, 3], values: [['001', 'new value'], ['002', '=literal']] });
  assert.deepEqual(e.state, { prevented: 1, stopped: 1, reads: ['text/plain'] });
  assert.deepEqual(target, [2, 3]);
});

test('quoted tabs, multiline cells and doubled quotes survive', () => {
  const e = event('"a\tb"\t"line 1\r\nline 2"\n"says ""hi"""\tend\n');
  assert.deepEqual(readPlainTextPaste(e, [0, 0]).values, [['a\tb', 'line 1\r\nline 2'], ['says "hi"', 'end']]);
});

test('keeps trailing blank cells and one real blank row', () => {
  assert.deepEqual(readPlainTextPaste(event('a\t\n\t\n'), [0, 0]).values, [['a', ''], ['', '']]);
});

test('empty text is a consumed no-op', () => {
  const e = event('');
  assert.equal(readPlainTextPaste(e, [0, 0]), undefined);
  assert.equal(e.state.prevented, 1);
});

test('no selected cell, already handled, or noncancelable events are untouched', () => {
  for (const [e, target] of [[event('a'), undefined], [event('a', { defaultPrevented: true }), [0, 0]], [event('a', { cancelable: false }), [0, 0]]]) {
    assert.equal(readPlainTextPaste(e, target), undefined);
    assert.deepEqual(e.state, { prevented: 0, stopped: 0, reads: [] });
  }
});

test('native editors, editable content and textbox descendants keep normal paste', () => {
  for (const target of [
    { nodeType: 1, isContentEditable: true, closest: () => null },
    { nodeType: 1, closest: selector => selector.includes('textarea') ? {} : null },
    { nodeType: 3, parentElement: { isContentEditable: true, closest: () => null } },
  ]) {
    const e = event('a', { target });
    assert.equal(readPlainTextPaste(e, [0, 0]), undefined);
    assert.equal(e.state.prevented, 0);
  }
});

test('malformed and ragged input are blocked before returning a batch', () => {
  for (const text of ['"unfinished', 'a\tb\n1']) {
    const e = event(text);
    assert.throws(() => readPlainTextPaste(e, [0, 0]));
    assert.equal(e.state.prevented, 1);
    assert.equal(e.state.stopped, 1);
  }
});

test('missing plain text does not fall back to HTML', () => {
  const e = event('old', { clipboardData: { types: ['text/html'], getData() { throw new Error('HTML must not be read'); } } });
  assert.throws(() => readPlainTextPaste(e, [0, 0]), /plain text/i);
  assert.equal(e.state.prevented, 1);
});

test('bounds fail rather than silently truncating cells', () => {
  for (const text of ['a'.repeat(100001), Array(1002).fill('a').join('\n'), Array(65).fill('a').join('\t')]) {
    assert.throws(() => readPlainTextPaste(event(text), [0, 0]));
  }
});

test('invalid coordinates fail before intercepting the event', () => {
  for (const target of [[-1, 0], [0.5, 1], [NaN, 0], [0], [0, 0, 1], Array(2)]) {
    const e = event('a');
    assert.throws(() => readPlainTextPaste(e, target), TypeError);
    assert.equal(e.state.prevented, 0);
  }
});
