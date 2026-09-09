// Copyright (c) 2026 Tevinch. SPDX-License-Identifier: MIT
import test, { beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { JSDOM, VirtualConsole } from 'jsdom';
import React, { act } from 'react';
import { Schema } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import { CellSelection, TableMap, tableNodes } from '@tiptap/pm/tables';
import { SelectionCsvError } from './selection-csv.mjs';

// React DOM detects input-event support when imported, so install the DOM first.
const browserErrors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', error => browserErrors.push(error.message));
const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost/', virtualConsole });
globalThis.window = dom.window; globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
after(() => dom.window.close());

const compiled = new URL(`.copy-check-${process.pid}.mjs`, import.meta.url);
await build({ entryPoints: [fileURLToPath(new URL('copy-selected-csv.tsx', import.meta.url))], outfile: fileURLToPath(compiled), format: 'esm', platform: 'node', jsx: 'automatic', logLevel: 'silent' });
const { default: CopySelectedCsv } = await import(compiled.href);
after(() => fs.rm(compiled, { force: true }));
const schema = new Schema({ nodes: { doc: { content: 'block+' }, paragraph: { group: 'block', content: 'text*', toDOM: () => ['p', 0] }, text: {}, ...tableNodes({ tableGroup: 'block', cellContent: 'block+' }) } });
function selected(rows) {
  const table = schema.nodes.table.create(null, rows.map(row => schema.nodes.table_row.create(null, row.map(value => schema.nodes.table_cell.create(null, schema.nodes.paragraph.create(null, value ? schema.text(value) : null))))));
  const doc = schema.nodes.doc.create(null, table), map = TableMap.get(table);
  return CellSelection.create(doc, 1 + map.map[0], 1 + map.map.at(-1));
}
let root, current, written, readSelection;
beforeEach(async () => {
  document.body.innerHTML = '<div id="app"></div>';
  browserErrors.length = 0;
  written = [];
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { written.push(text); } } });
  current = selected([['32', 'Berlin'], ['28', 'Paris']]);
  readSelection = () => current;
  root = createRoot(document.querySelector('#app'));
  await act(async () => root.render(React.createElement(CopySelectedCsv, { getSelection: () => readSelection() })));
});
afterEach(async () => { await act(async () => root.unmount()); assert.deepEqual(browserErrors, [], 'No unhandled browser errors'); });
const click = async button => { assert(button, 'Copy control must be present'); await act(async () => { button.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); }); };
const copyButton = () => document.querySelector('button');

test('writes the current selected rectangle only after an explicit click', async () => {
  assert.deepEqual(written, []);
  await click(copyButton());
  assert.deepEqual(written, ['32,Berlin\r\n28,Paris']);
  assert.equal(document.querySelector('textarea').value, '32,Berlin\n28,Paris');
  assert.match(document.querySelector('[role="status"]').textContent, /copied/i);
});
test('uses the selection at click time instead of the original mounted selection', async () => {
  current = selected([['001', 'new']]);
  await click(copyButton());
  assert.deepEqual(written, ['001,new']);
});
test('preserves a visible manual-copy result when clipboard writing is rejected', async () => {
  navigator.clipboard.writeText = async () => { throw new Error('NotAllowedError'); };
  await click(copyButton());
  assert.equal(document.querySelector('textarea').value, '32,Berlin\n28,Paris');
  assert.match(document.querySelector('[role="status"]').textContent, /manual/i);
  await click([...document.querySelectorAll('button')].find(button => /select output/i.test(button.textContent)));
  const output = document.querySelector('textarea');
  assert.equal(document.activeElement, output);
  assert.equal(output.selectionStart, 0); assert.equal(output.selectionEnd, output.value.length);
});
test('offers manual copying when the clipboard API is unavailable', async () => {
  Object.defineProperty(navigator, 'clipboard', { value: undefined });
  await click(copyButton());
  assert.equal(document.querySelector('textarea').value, '32,Berlin\n28,Paris');
  assert.match(document.querySelector('[role="status"]').textContent, /manual/i);
});
test('clears an earlier result if the user no longer has a cell selection', async () => {
  await click(copyButton());
  current = TextSelection.create(current.$anchorCell.doc, 4);
  await click(copyButton());
  assert.equal(written.length, 1);
  assert.equal(document.querySelector('textarea'), null);
  assert.match(document.querySelector('[role="status"]').textContent, /select.*cells/i);
});
test('prevents duplicate writes while one copy is pending', async () => {
  let finish, calls = 0;
  navigator.clipboard.writeText = async () => { calls++; await new Promise(resolve => { finish = resolve; }); };
  await click(copyButton()); await click(copyButton());
  assert.equal(calls, 1); assert.equal(copyButton().disabled, true);
  await act(async () => finish());
  assert.equal(copyButton().disabled, false);
});
test('does not expose arbitrary error text from the host selection callback', async () => {
  readSelection = () => { throw new Error('private example value'); };
  await click(copyButton());
  assert.deepEqual(written, []);
  assert.equal(document.querySelector('textarea'), null);
  assert(!document.body.textContent.includes('private example value'));
});
test('does not expose an unknown structural error code from the host callback', async () => {
  readSelection = () => { throw new SelectionCsvError('private example value'); };
  await click(copyButton());
  assert.match(document.querySelector('[role="status"]').textContent, /could not read/i);
  assert(!document.body.textContent.includes('private example value'));
});
test('uses fixed messages for known errors without displaying a modified message', async () => {
  const error = new SelectionCsvError('UNSUPPORTED_CONTENT');
  error.message = 'private example value';
  readSelection = () => { throw error; };
  await click(copyButton());
  assert.match(document.querySelector('[role="status"]').textContent, /unsupported/i);
  assert(!document.body.textContent.includes('private example value'));
});
