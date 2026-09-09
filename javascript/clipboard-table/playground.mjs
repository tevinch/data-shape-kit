// Copyright (c) 2026 Tevinch. SPDX-License-Identifier: MIT
import { buildPlaygroundOutput } from './playground-output.mjs';

const byId = id => document.getElementById(id);
const source = byId('source');
const headers = byId('headers');
const format = byId('output-format');
const inputFormat = byId('input-format');
let rawText = '';
let result = null;
let revision = 0;
let copying = false;
const examples = {
  tsv: 'SKU\tQuantity\tNotes\r\n00123\t2\t"First line\nSecond line"\r\n00456\t\t"Says ""hello"""\r\n',
  csv: 'SKU,Quantity,Notes\r\n00123,2,"First line\nSecond line"\r\n00456,,"Says ""hello"", then leaves"\r\n',
};
const messages = {
  UNCLOSED_QUOTE: 'Close the quoted cell',
  UNEXPECTED_QUOTE: 'Enclose the whole cell in double quotes and double any quote inside it',
  EMPTY_HEADER: 'A JSON key is blank; give it a name or turn off the first-row option',
  DUPLICATE_HEADER: 'JSON keys must be unique; rename this key or turn off the first-row option',
};

function updateMode() {
  const markdown = format.value === 'markdown';
  const csv = format.value === 'csv';
  const label = csv ? 'CSV' : markdown ? 'Markdown' : 'JSON';
  byId('copy').textContent = `Copy ${label}`;
  byId('download').textContent = `Download ${label}`;
  byId('output-summary').textContent = `View ${label}`;
  byId('output-label').textContent = `Complete ${label} output`;
  byId('header-label').textContent = `Use the first row as ${csv ? 'preview headings' : markdown ? 'table headings' : 'JSON keys'}`;
  byId('limits').textContent = `${label}: up to ${markdown ? '100,000 UTF-16 code units, 1,000 rows and 64 columns' : '1,000,000 UTF-16 code units, 10,000 rows and 256 columns'}. Files are saved only when you choose Download.`;
  byId('format-note').hidden = !markdown && !csv;
  byId('format-note').textContent = csv
    ? 'CSV includes every input row. The heading option affects only the preview. Receiving applications may infer types. Use Download CSV to retain serialized line endings; manual copying from the text box may normalize them.'
    : 'Markdown escapes punctuation and uses <br> for cell line breaks. Rendered whitespace may differ; HTML line breaks depend on your Markdown renderer.';
  byId('output-details').open = markdown || csv;
  byId('input-help').textContent = `Choose ${inputFormat.value === 'csv' ? 'CSV for comma-separated text' : 'TSV for tab-separated spreadsheet text'}. Pasting replaces this box and parses it. After editing, choose Parse.`;
}

function errorMessage(error) {
  const markdown = format.value === 'markdown';
  const limits = markdown ? ['100,000', '1,000', '64'] : ['1,000,000', '10,000', '256'];
  const modeMessages = {
    UNEXPECTED_CHARACTER: `Only a ${inputFormat.value === 'csv' ? 'comma' : 'tab'} or row separator may follow a closing quote`,
    MAX_CHARS: `The input exceeds ${limits[0]} UTF-16 code units`,
    MAX_ROWS: `The input exceeds ${limits[1]} rows`,
    MAX_COLUMNS: `A row exceeds ${limits[2]} columns`,
    RAGGED_ROW: markdown
      ? 'Every Markdown row must have the same number of cells; fill or remove the extra cells'
      : 'This row has a different number of cells from the header; fix it or turn off the first-row option',
  };
  return `${modeMessages[error.code] || messages[error.code] || 'The text could not be parsed'}${error.row ? ` (row ${error.row}, column ${error.column})` : ''}.`;
}

function clearOutput(message) {
  revision++;
  result = null;
  byId('output').value = '';
  byId('table').replaceChildren();
  byId('table-scroll').hidden = true;
  byId('output-details').hidden = true;
  byId('empty-state').hidden = false;
  byId('preview-note').textContent = '';
  byId('download').disabled = true;
  byId('copy').disabled = true;
  byId('error').hidden = true;
  byId('error').textContent = '';
  byId('status').textContent = message;
}

function parse() {
  clearOutput('');
  if (rawText === '') return;
  try {
    result = buildPlaygroundOutput(rawText, format.value, headers.checked, inputFormat.value);
    if (!result) return;
    const { data, headings, content, label } = result;
    const width = headings.length;
    byId('output').value = content;
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
      th.textContent = headings[col];
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
    byId('output-details').hidden = false;
    byId('download').disabled = false;
    byId('copy').disabled = copying;
    byId('status').textContent = format.value === 'csv'
      ? 'CSV ready. Every input row is included.'
      : format.value === 'markdown' ? 'Markdown ready. Cell text is escaped for a table.' : 'Parsed. All values remain strings.';
    byId('preview-note').textContent = data.length > 30 || width > 8
      ? `Preview shows at most 30 data rows and 8 columns. The ${label} output, copy and download include the complete result.`
      : `The ${label} output, copy and download include the complete result.`;
  } catch (error) {
    clearOutput('No result was exported.');
    byId('error').textContent = errorMessage(error);
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
format.addEventListener('change', () => { updateMode(); parse(); });
inputFormat.addEventListener('change', () => { updateMode(); parse(); });
byId('example').addEventListener('click', () => {
  headers.checked = true;
  rawText = examples[inputFormat.value];
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
  if (!result) return;
  const url = URL.createObjectURL(new Blob([result.downloadContent], { type: result.mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = result.fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
byId('copy').addEventListener('click', async () => {
  if (!result || copying) return;
  const current = revision;
  const { content, label } = result;
  copying = true;
  byId('copy').disabled = true;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(content);
    if (current === revision) byId('status').textContent = `${label} copied.`;
  } catch {
    if (current === revision) {
      byId('output-details').open = true;
      byId('output').focus();
      byId('output').select();
      byId('status').textContent = 'Automatic copy is unavailable. The complete output is selected; copy it manually.';
    }
  } finally {
    copying = false;
    byId('copy').disabled = !result;
  }
});
updateMode();
clearOutput('Ready. Paste a table or load the example.');
