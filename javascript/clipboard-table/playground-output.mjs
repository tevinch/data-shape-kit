// Copyright (c) 2026 Tevinch. SPDX-License-Identifier: MIT
import { parseClipboard, toRecords } from './index.mjs';
import { parseDelimited, formatMarkdown, TABLE_LIMITS } from '../markdown-table/index.mjs';

const jsonLimits = Object.freeze({ maxChars: 1_000_000, maxRows: 10_000, maxColumns: 256 });

function formatCsv(rows) {
  return rows.map(row => row.map(field => `"${field.replaceAll('"', '""')}"`).join(',')).join('\r\n');
}

export function buildPlaygroundOutput(text, format = 'json', firstRowHeaders = true, inputFormat = 'tsv') {
  if (format !== 'json' && format !== 'markdown' && format !== 'csv') throw new TypeError('Choose JSON, Markdown, or CSV');
  if (typeof firstRowHeaders !== 'boolean') throw new TypeError('Expected a heading option');
  if (inputFormat !== 'tsv' && inputFormat !== 'csv') throw new TypeError('Choose TSV or CSV');
  const limits = format === 'markdown' ? TABLE_LIMITS : jsonLimits;
  const rows = inputFormat === 'csv' ? parseDelimited(text, ',', limits) : parseClipboard(text, limits);
  if (!rows.length) return null;
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const generatedHeadings = Array.from({ length: width }, (_, i) => `Column ${i + 1}`);
  let headings = generatedHeadings;
  if (firstRowHeaders) {
    headings = format === 'csv'
      ? [...rows[0], ...generatedHeadings.slice(rows[0].length)]
      : rows[0];
  }
  const markdown = format === 'markdown' ? formatMarkdown(rows, { firstRowHeaders }) : null;
  const csv = format === 'csv' ? formatCsv(rows) : null;
  const content = csv ?? (markdown ? markdown.markdown : JSON.stringify(firstRowHeaders ? toRecords(rows) : rows, null, 2));
  return {
    rows,
    data: firstRowHeaders ? rows.slice(1) : rows,
    headings,
    content,
    downloadContent: content + (format === 'csv' ? '\r\n' : '\n'),
    fileName: format === 'csv' ? 'clipboard-table.csv' : format === 'markdown' ? 'clipboard-table.md' : 'clipboard-table.json',
    mimeType: format === 'csv' ? 'text/csv;charset=utf-8' : format === 'markdown' ? 'text/markdown;charset=utf-8' : 'application/json;charset=utf-8',
    label: format === 'csv' ? 'CSV' : format === 'markdown' ? 'Markdown' : 'JSON',
  };
}
