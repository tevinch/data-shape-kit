// Copyright (c) 2026 Tevinch. SPDX-License-Identifier: MIT
import { parseDelimited, TableTextError } from '../../javascript/markdown-table/index.mjs';

/** Read one native paste into a selected grid cell. Application writes stay with the caller. */
export function readPlainTextPaste(event, target) {
  if (target === undefined || event.defaultPrevented || !event.cancelable) return;
  if (!Array.isArray(target) || target.length !== 2 || !Number.isSafeInteger(target[0]) || target[0] < 0 ||
      !Number.isSafeInteger(target[1]) || target[1] < 0) {
    throw new TypeError('Paste target must be a nonnegative [column, row] pair.');
  }

  const element = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
  if (element?.isContentEditable || element?.closest?.('input, textarea, select, [role="textbox"]') ||
      element?.closest?.('[contenteditable]')?.isContentEditable) return;

  // Consume before parsing so rejected input cannot fall through to another paste path.
  event.preventDefault();
  event.stopPropagation();
  if (!event.clipboardData || !Array.from(event.clipboardData.types).includes('text/plain')) {
    throw new Error('This paste does not include plain text.');
  }
  const values = parseDelimited(event.clipboardData.getData('text/plain'), '\t');
  if (values.length === 0) return;
  const width = values[0].length;
  for (let row = 1; row < values.length; row++) {
    if (values[row].length !== width) throw new TableTextError('RAGGED_ROW', row + 1, Math.min(values[row].length, width) + 1);
  }
  return { target: [target[0], target[1]], values };
}
