// Copyright (c) 2026 Tevinch. SPDX-License-Identifier: MIT
import { parseClipboard, toRecords } from './index.mjs';
import { parseDelimited, formatMarkdown, TABLE_LIMITS } from '../markdown-table/index.mjs';

const jsonLimits = Object.freeze({ maxChars: 1_000_000, maxRows: 10_000, maxColumns: 256 });

export function buildPlaygroundOutput(text, format = 'json', firstRowHeaders = true, inputFormat = 'tsv') {
  if (format !== 'json' && format !== 'markdown') throw new TypeError('Choose JSON or Markdown');
  if (typeof firstRowHeaders !== 'boolean') throw new TypeError('Expected a heading option');
  if (inputFormat !== 'tsv' && inputFormat !== 'csv') throw new TypeError('Choose TSV or CSV');
  const limits = format === 'markdown' ? TABLE_LIMITS : jsonLimits;
  const rows = inputFormat === 'csv' ? parseDelimited(text, ',', limits) : parseClipboard(text, limits);
  if (!rows.length) return null;
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const markdown = format === 'markdown' ? formatMarkdown(rows, { firstRowHeaders }) : null;
  return {
    rows,
    data: firstRowHeaders ? rows.slice(1) : rows,
    headings: firstRowHeaders ? rows[0] : Array.from({ length: width }, (_, i) => `Column ${i + 1}`),
    content: markdown ? markdown.markdown : JSON.stringify(firstRowHeaders ? toRecords(rows) : rows, null, 2),
    fileName: format === 'markdown' ? 'clipboard-table.md' : 'clipboard-table.json',
    mimeType: format === 'markdown' ? 'text/markdown;charset=utf-8' : 'application/json;charset=utf-8',
    label: format === 'markdown' ? 'Markdown' : 'JSON',
  };
}
