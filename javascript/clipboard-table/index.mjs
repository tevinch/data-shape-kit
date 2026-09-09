// Copyright (c) 2026 Tevinch. SPDX-License-Identifier: MIT
/** A structural error. Coordinates are one-based table cells, offset is UTF-16. */
export class ClipboardTableError extends Error {
  constructor(code, row, column, offset) {
    super(`${code} at row ${row}, column ${column}`);
    this.name = 'ClipboardTableError';
    this.code = code;
    this.row = row;
    this.column = column;
    if (offset !== undefined) this.offset = offset;
  }
}

const defaults = Object.freeze({ maxChars: 1_000_000, maxRows: 10_000, maxColumns: 256 });

/** Parse tab-separated plain clipboard text without trimming or type conversion. */
export function parseClipboard(text, options = {}) {
  if (typeof text !== 'string') throw new TypeError('Expected clipboard text');
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Expected a limits object');
  }
  const limits = { ...defaults };
  for (const key of Object.keys(options)) {
    if (!Object.hasOwn(defaults, key) || !Number.isSafeInteger(options[key]) || options[key] < 1) {
      throw new TypeError('Limits must be known positive safe integers');
    }
    limits[key] = options[key];
  }
  if (text.length > limits.maxChars) throw new ClipboardTableError('MAX_CHARS', 1, 1, 0);
  let offset = text.startsWith('\uFEFF') ? 1 : 0;
  if (offset === text.length) return [];
  const rows = [];
  let row = [];
  let field = '';
  let state = 'start';
  const fail = code => { throw new ClipboardTableError(code, rows.length + 1, row.length + 1, offset); };
  const endField = () => {
    if (row.length >= limits.maxColumns) fail('MAX_COLUMNS');
    row.push(field);
    field = '';
    state = 'start';
  };
  const endRow = () => {
    if (rows.length >= limits.maxRows) fail('MAX_ROWS');
    rows.push(row);
    row = [];
  };

  for (; offset < text.length; offset++) {
    const ch = text[offset];
    if (state === 'quoted') {
      if (ch === '"') {
        if (text[offset + 1] === '"') { field += '"'; offset++; }
        else state = 'closed';
      } else field += ch;
      continue;
    }
    if (ch === '\t') { endField(); continue; }
    if (ch === '\n' || ch === '\r') {
      endField(); endRow();
      if (ch === '\r' && text[offset + 1] === '\n') offset++;
      continue;
    }
    if (state === 'closed') fail('UNEXPECTED_CHARACTER');
    if (state === 'start' && ch === '"') state = 'quoted';
    else { field += ch; state = 'unquoted'; }
  }
  if (state === 'quoted') fail('UNCLOSED_QUOTE');
  if (row.length || field.length || state !== 'start') { endField(); endRow(); }
  return rows;
}

function checkRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError('Expected an array of rows');
  for (const row of rows) {
    if (!Array.isArray(row) || row.length === 0) throw new TypeError('Each row must contain at least one cell');
    for (const cell of row) {
      if (typeof cell !== 'string') throw new TypeError('Every cell must be a string');
    }
  }
}

/** Serialize strings as TSV. This does not neutralize formulas for a spreadsheet. */
export function formatClipboard(rows) {
  checkRows(rows);
  return rows.map(row => row.map(cell => {
    if (cell === '' || /[\t\r\n"\uFEFF]/u.test(cell)) return `"${cell.replaceAll('"', '""')}"`;
    return cell;
  }).join('\t')).join('\r\n');
}

/** Use exact first-row headers; reject ambiguous headers and nonrectangular data. */
export function toRecords(rows) {
  checkRows(rows);
  if (rows.length === 0) return [];
  const [headers, ...data] = rows;
  const seen = new Set();
  headers.forEach((header, column) => {
    if (header.trim() === '') throw new ClipboardTableError('EMPTY_HEADER', 1, column + 1);
    if (seen.has(header)) throw new ClipboardTableError('DUPLICATE_HEADER', 1, column + 1);
    seen.add(header);
  });
  return data.map((row, index) => {
    if (row.length !== headers.length) {
      throw new ClipboardTableError('RAGGED_ROW', index + 2, Math.min(row.length, headers.length) + 1);
    }
    return Object.fromEntries(headers.map((header, column) => [header, row[column]]));
  });
}
