// Copyright (c) 2026 Tevinch. SPDX-License-Identifier: MIT
import { parseClipboard, toRecords } from './index.mjs';

const byId = id => document.getElementById(id);
const source = byId('source');
const headers = byId('headers');
let rawText = '';
let json = '';
const example = 'SKU\tQuantity\tNotes\r\n00123\t2\t"First line\nSecond line"\r\n00456\t\t"Says ""hello"""\r\n';
const messages = {
  UNCLOSED_QUOTE: 'Close the quoted cell',
  UNEXPECTED_CHARACTER: 'Only a tab or row separator may follow a closing quote',
  EMPTY_HEADER: 'A JSON key is blank; give it a name or turn off the first-row option',
  DUPLICATE_HEADER: 'JSON keys must be unique; rename this key or turn off the first-row option',
  RAGGED_ROW: 'This row has a different number of cells from the header; fix it or turn off the first-row option',
  MAX_CHARS: 'The input exceeds 1,000,000 UTF-16 code units',
  MAX_ROWS: 'The input exceeds 10,000 rows',
  MAX_COLUMNS: 'A row exceeds 256 columns',
};

function clearOutput(message) {
  json = '';
  byId('json').value = '';
  byId('table').replaceChildren();
  byId('table-scroll').hidden = true;
  byId('json-details').hidden = true;
  byId('empty-state').hidden = false;
  byId('preview-note').textContent = '';
  byId('download').disabled = true;
  byId('error').hidden = true;
  byId('error').textContent = '';
  byId('status').textContent = message;
}

function parse() {
  clearOutput('');
  if (rawText === '') return;
  try {
    const rows = parseClipboard(rawText);
    const output = headers.checked ? toRecords(rows) : rows;
    const data = headers.checked ? rows.slice(1) : rows;
    const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
    json = JSON.stringify(output, null, 2);
    byId('json').value = json;
    const table = byId('table');
    const caption = document.createElement('caption');
    caption.textContent = `${data.length} data ${data.length === 1 ? 'row' : 'rows'} · ${width} ${width === 1 ? 'column' : 'columns'}`;
    table.append(caption);
    const head = document.createElement('thead');
    const heading = document.createElement('tr');
    const visibleColumns = Math.min(width, 8);
    for (let col = 0; col < visibleColumns; col++) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = headers.checked ? rows[0][col] : `Column ${col + 1}`;
      heading.append(th);
    }
    head.append(heading);
    table.append(head);
    const body = document.createElement('tbody');
    for (const row of data.slice(0, 30)) {
      const tr = document.createElement('tr');
      for (let col = 0; col < visibleColumns; col++) {
        const td = document.createElement('td');
        if (col >= row.length) {
          td.textContent = 'missing';
          td.className = 'empty';
        } else if (row[col] === '') {
          td.textContent = 'empty';
          td.className = 'empty';
        } else td.textContent = row[col];
        tr.append(td);
      }
      body.append(tr);
    }
    table.append(body);
    byId('empty-state').hidden = true;
    byId('table-scroll').hidden = false;
    byId('json-details').hidden = false;
    byId('download').disabled = false;
    byId('status').textContent = 'Parsed. All values remain strings.';
    byId('preview-note').textContent = data.length > 30 || width > 8
      ? 'Preview shows at most 30 data rows and 8 columns. The JSON download includes the complete result.'
      : 'The JSON download includes the complete result.';
  } catch (error) {
    clearOutput('No result was exported.');
    byId('error').textContent = `${messages[error.code] || 'The text could not be parsed'}${error.row ? ` (row ${error.row}, column ${error.column})` : ''}.`;
    byId('error').hidden = false;
  }
}

source.addEventListener('input', () => {
  rawText = source.value;
  clearOutput('Input changed. Choose Parse to update the result.');
});
source.addEventListener('paste', event => {
  if (!event.clipboardData?.types.includes('text/plain')) return;
  event.preventDefault();
  rawText = event.clipboardData.getData('text/plain');
  source.value = rawText;
  parse();
});
byId('parse').addEventListener('click', parse);
headers.addEventListener('change', parse);
byId('example').addEventListener('click', () => {
  headers.checked = true;
  rawText = example;
  source.value = rawText;
  parse();
});
byId('clear').addEventListener('click', () => {
  rawText = '';
  source.value = '';
  clearOutput('Cleared.');
  source.focus();
});
byId('download').addEventListener('click', () => {
  if (!json) return;
  const url = URL.createObjectURL(new Blob([`${json}\n`], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'clipboard-table.json';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
clearOutput('Ready. Paste a table or load the example.');
