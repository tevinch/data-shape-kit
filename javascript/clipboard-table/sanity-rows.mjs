// Copyright (c) 2026 Tevinch. SPDX-License-Identifier: MIT

/**
 * Apply a rectangular string grid to Sanity-shaped rows without mutating input.
 * This only returns data: it does not send patches or connect to Sanity.
 */
export function applyGridPaste(rows, block, startRow, startColumn, options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Options must be an object');
  }
  const allowed = ['rowType', 'createKey', 'maxRows', 'maxColumns'];
  if (Object.keys(options).some(key => !allowed.includes(key))) {
    throw new TypeError('Unknown option');
  }
  const { rowType = 'tableRow', createKey, maxRows = 10_000, maxColumns = 256 } = options;
  if (!Number.isSafeInteger(maxRows) || maxRows < 1 || !Number.isSafeInteger(maxColumns) || maxColumns < 1) {
    throw new TypeError('Limits must be positive safe integers');
  }
  if (typeof rowType !== 'string' || !rowType.trim() || (createKey !== undefined && typeof createKey !== 'function')) {
    throw new TypeError('Provide a row type and an optional key factory function');
  }
  if (!Array.isArray(rows) || !Array.isArray(block) || block.length === 0) {
    throw new TypeError('Rows and a nonempty paste block must be arrays');
  }
  if (rows.length > maxRows || block.length > maxRows) throw new RangeError('Row limit exceeded');

  const keys = new Set();
  let width = 0;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row || typeof row !== 'object' || Array.isArray(row) ||
        typeof row._key !== 'string' || !row._key.trim() || keys.has(row._key) ||
        typeof row._type !== 'string' || !row._type.trim() || !Array.isArray(row.cells)) {
      throw new TypeError('Rows require unique nonblank keys, types and cells arrays');
    }
    keys.add(row._key);
    if (r === 0) width = row.cells.length;
    if (row.cells.length !== width) throw new TypeError('Existing rows must be rectangular');
    if (width > maxColumns) throw new RangeError('Column limit exceeded');
    for (let c = 0; c < width; c++) {
      if (typeof row.cells[c] !== 'string') throw new TypeError('Existing cells must be strings');
    }
  }
  let blockWidth = 0;
  for (let r = 0; r < block.length; r++) {
    const cells = block[r];
    if (!Array.isArray(cells) || cells.length === 0) throw new TypeError('Paste rows must contain cells');
    if (r === 0) blockWidth = cells.length;
    if (cells.length !== blockWidth) throw new TypeError('Paste rows must be rectangular');
    if (blockWidth > maxColumns) throw new RangeError('Column limit exceeded');
    for (let c = 0; c < blockWidth; c++) {
      if (typeof cells[c] !== 'string') throw new TypeError('Pasted cells must be strings');
    }
  }
  if (!Number.isSafeInteger(startRow) || startRow < 0 || startRow > rows.length ||
      !Number.isSafeInteger(startColumn) || startColumn < 0 || startColumn > width) {
    throw new RangeError('Paste origin must be inside the existing grid or at its edge');
  }
  const height = Math.max(rows.length, startRow + block.length);
  const columns = Math.max(width, startColumn + blockWidth);
  if (!Number.isSafeInteger(height) || height > maxRows) throw new RangeError('Row limit exceeded');
  if (!Number.isSafeInteger(columns) || columns > maxColumns) throw new RangeError('Column limit exceeded');
  if (height > rows.length && !createKey) throw new TypeError('Creating rows requires createKey');

  const output = rows.map(row => ({ ...row, cells: [...row.cells] }));
  for (const row of output) {
    while (row.cells.length < columns) row.cells.push('');
  }
  while (output.length < height) {
    const key = createKey();
    if (typeof key !== 'string' || !key.trim() || keys.has(key)) {
      throw new TypeError('Generated keys must be unique nonblank strings');
    }
    keys.add(key);
    output.push({ _type: rowType, _key: key, cells: Array(columns).fill('') });
  }
  for (let r = 0; r < block.length; r++) {
    for (let c = 0; c < blockWidth; c++) output[startRow + r].cells[startColumn + c] = block[r][c];
  }
  return output;
}
