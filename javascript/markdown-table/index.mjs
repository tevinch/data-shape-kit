// Copyright (c) 2026 Tevinch. SPDX-License-Identifier: MIT
export const TABLE_LIMITS = Object.freeze({ maxChars: 100_000, maxRows: 1000, maxColumns: 64 });

/** One-based cell coordinates; messages never include input values. */
export class TableTextError extends Error {
  constructor(code, row, column) {
    super(`${code} at row ${row}, column ${column}`);
    this.name = 'TableTextError';
    this.code = code;
    this.row = row;
    this.column = column;
  }
}

/** Strict comma- or tab-delimited text. Quoted cells may contain line endings. */
export function parseDelimited(text, delimiter) {
  if (typeof text !== 'string') throw new TypeError('Expected text');
  if (delimiter !== ',' && delimiter !== '\t') throw new TypeError('Choose comma or tab');
  if (text.length > TABLE_LIMITS.maxChars) throw new TableTextError('MAX_CHARS', 1, 1);
  let offset = text.startsWith('\uFEFF') ? 1 : 0;
  if (offset === text.length) return [];
  const rows = [];
  let row = [], field = '', state = 'start';
  const fail = code => { throw new TableTextError(code, rows.length + 1, row.length + 1); };
  const endField = () => {
    if (row.length === TABLE_LIMITS.maxColumns) fail('MAX_COLUMNS');
    row.push(field); field = ''; state = 'start';
  };
  const endRow = () => {
    if (rows.length === TABLE_LIMITS.maxRows) fail('MAX_ROWS');
    rows.push(row); row = [];
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
    if (ch === delimiter) { endField(); continue; }
    if (ch === '\r' || ch === '\n') {
      endField(); endRow();
      if (ch === '\r' && text[offset + 1] === '\n') offset++;
      continue;
    }
    if (state === 'closed') fail('UNEXPECTED_CHARACTER');
    if (ch === '"') {
      if (state !== 'start') fail('UNEXPECTED_QUOTE');
      state = 'quoted';
    } else { field += ch; state = 'unquoted'; }
  }
  if (state === 'quoted') fail('UNCLOSED_QUOTE');
  if (row.length || field.length || state !== 'start') { endField(); endRow(); }
  return rows;
}

function literalCell(text) {
  // Escape in one pass so generated entities/backslashes are not escaped again.
  return text.replace(/\r\n|[\r\n\u2028\u2029]|[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/gu, ch => {
    if (ch === '\n' || ch === '\r' || ch === '\r\n') return '<br>';
    if (ch === '\u2028') return '&#8232;';
    if (ch === '\u2029') return '&#8233;';
    if (ch === '&') return '&amp;';
    if (ch === '<') return '&lt;';
    if (ch === '>') return '&gt;';
    return `\\${ch}`;
  });
}

const alignmentRules = Object.freeze({ none: '---', left: ':---', center: ':---:', right: '---:' });

/** Format literal text as GFM. Rendering may collapse spaces/tabs within cells. */
export function formatMarkdown(matrix, options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Expected options');
  for (const key of Object.keys(options)) {
    if (key !== 'firstRowHeaders' && key !== 'alignments') throw new TypeError('Unknown format option');
  }
  const { firstRowHeaders = true, alignments = [] } = options;
  if (typeof firstRowHeaders !== 'boolean' || !Array.isArray(alignments)) throw new TypeError('Invalid options');
  if (!Array.isArray(matrix)) throw new TypeError('Expected rows');
  if (matrix.length > TABLE_LIMITS.maxRows) throw new TableTextError('MAX_ROWS', TABLE_LIMITS.maxRows + 1, 1);
  let chars = 0;
  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r];
    if (!Array.isArray(row) || !row.length) throw new TypeError('Each row must contain cells');
    if (row.length > TABLE_LIMITS.maxColumns) throw new TableTextError('MAX_COLUMNS', r + 1, TABLE_LIMITS.maxColumns + 1);
    for (let c = 0; c < row.length; c++) {
      if (typeof row[c] !== 'string') throw new TypeError('Every cell must be a string');
      chars += row[c].length;
      if (chars > TABLE_LIMITS.maxChars) throw new TableTextError('MAX_CHARS', r + 1, c + 1);
    }
    if (row.length !== matrix[0].length) throw new TableTextError('RAGGED_ROW', r + 1, Math.min(row.length, matrix[0].length) + 1);
  }
  const width = matrix[0]?.length ?? 0;
  if (alignments.length > width) throw new TypeError('Too many alignments');
  for (const align of alignments) {
    if (typeof align !== 'string' || !Object.hasOwn(alignmentRules, align)) throw new TypeError('Invalid alignment');
  }
  if (!width) return { headers: [], rows: [], markdown: '' };
  const headers = firstRowHeaders ? [...matrix[0]] : Array.from({ length: width }, (_, i) => `Column ${i + 1}`);
  const rows = matrix.slice(firstRowHeaders ? 1 : 0).map(row => [...row]);
  const line = row => `| ${row.map(literalCell).join(' | ')} |`;
  const separator = `| ${headers.map((_, i) => alignmentRules[alignments[i] ?? 'none']).join(' | ')} |`;
  return { headers, rows, markdown: [line(headers), separator, ...rows.map(line)].join('\n') };
}

export function buildMarkdownTable(text, options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Expected options with delimiter');
  const { delimiter, ...formatOptions } = options;
  return formatMarkdown(parseDelimited(text, delimiter), formatOptions);
}
