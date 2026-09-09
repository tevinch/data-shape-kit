// Copyright (c) 2026 Tevinch. SPDX-License-Identifier: MIT
import { CellSelection, TableMap } from '@tiptap/pm/tables';

export const CSV_LIMITS = Object.freeze({ maxRows: 1000, maxColumns: 64, maxChars: 100_000 });
export class SelectionCsvError extends Error {
  constructor(code, row = 1, column = 1) {
    super(`${code} at selected row ${row}, column ${column}`);
    this.name = 'SelectionCsvError';
    this.code = code;
    this.row = row;
    this.column = column;
  }
}
const isBreak = node => node.type.name === 'hardBreak' || node.type.name === 'hard_break';
function readText(cell, { row, column }) {
  cell.descendants(node => {
    if (node.type.spec.tableRole === 'table' || (node.isAtom && !node.isText && !isBreak(node))) {
      throw new SelectionCsvError('UNSUPPORTED_CONTENT', row, column);
    }
  });
  return cell.textBetween(0, cell.content.size, '\n', node => isBreak(node) ? '\n' : '');
}

/** Serialize an actual cell selection without changing editor state. */
export function selectionToCsv(selection, options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Expected options');
  if (Object.keys(options).some(key => key !== 'readCell')) throw new TypeError('Unknown option');
  const { readCell = readText } = options;
  if (typeof readCell !== 'function') throw new TypeError('Expected a cell text reader');
  if (!(selection instanceof CellSelection)) return undefined;
  const table = selection.$anchorCell.node(-1);
  const start = selection.$anchorCell.start(-1);
  const map = TableMap.get(table);
  if (map.problems?.length) throw new SelectionCsvError('MALFORMED_TABLE');
  const rect = map.rectBetween(selection.$anchorCell.pos - start, selection.$headCell.pos - start);
  if (rect.bottom - rect.top > CSV_LIMITS.maxRows) throw new SelectionCsvError('MAX_ROWS');
  if (rect.right - rect.left > CSV_LIMITS.maxColumns) throw new SelectionCsvError('MAX_COLUMNS');
  // The library identifies cells whose top-left position belongs to this rectangle.
  const remaining = new Set(map.cellsInRect(rect));
  const output = [];
  let size = 0;
  for (let r = rect.top; r < rect.bottom; r++) {
    const values = [];
    for (let c = rect.left; c < rect.right; c++) {
      const coordinate = { row: r - rect.top + 1, column: c - rect.left + 1 };
      const pos = map.map[r * map.width + c];
      const value = remaining.delete(pos) ? readCell(table.nodeAt(pos), coordinate) : '';
      if (typeof value !== 'string') throw new TypeError('Cell text reader must return a string');
      if (value.length > CSV_LIMITS.maxChars) throw new SelectionCsvError('MAX_CHARS', coordinate.row, coordinate.column);
      const encoded = value === '' || /[,"\r\n]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
      size += encoded.length + (c > rect.left ? 1 : r > rect.top ? 2 : 0);
      if (size > CSV_LIMITS.maxChars) throw new SelectionCsvError('MAX_CHARS', coordinate.row, coordinate.column);
      values.push(encoded);
    }
    output.push(values.join(','));
  }
  return output.join('\r\n');
}
