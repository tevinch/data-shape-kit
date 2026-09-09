// Copyright (c) 2026 Tevinch. SPDX-License-Identifier: MIT
export type ClipboardTableErrorCode =
  | 'MAX_CHARS' | 'MAX_ROWS' | 'MAX_COLUMNS'
  | 'UNCLOSED_QUOTE' | 'UNEXPECTED_CHARACTER'
  | 'EMPTY_HEADER' | 'DUPLICATE_HEADER' | 'RAGGED_ROW';

export interface ClipboardLimits {
  /** Maximum UTF-16 code units, including an initial BOM. Default: 1,000,000. */
  maxChars?: number;
  /** Maximum table records. Default: 10,000. */
  maxRows?: number;
  /** Maximum cells in each record. Default: 256. */
  maxColumns?: number;
}

export class ClipboardTableError extends Error {
  constructor(code: ClipboardTableErrorCode, row: number, column: number, offset?: number);
  readonly code: ClipboardTableErrorCode;
  /** One-based table row (embedded newlines do not increment this). */
  readonly row: number;
  /** One-based table column. */
  readonly column: number;
  /** Zero-based UTF-16 position in original input, present for parser errors. */
  readonly offset?: number;
}

export function parseClipboard(text: string, options?: ClipboardLimits): string[][];
export function formatClipboard(rows: readonly (readonly string[])[]): string;
export function toRecords(rows: readonly (readonly string[])[]): Record<string, string>[];
