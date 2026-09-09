// Copyright (c) 2026 Tevinch. SPDX-License-Identifier: MIT
export type Delimiter = ',' | '\t';
export type Alignment = 'none' | 'left' | 'center' | 'right';
export interface FormatOptions {
  firstRowHeaders?: boolean;
  alignments?: readonly Alignment[];
}
export interface TableResult {
  headers: string[];
  rows: string[][];
  markdown: string;
}
export const TABLE_LIMITS: Readonly<{ maxChars: 100000; maxRows: 1000; maxColumns: 64 }>;
export class TableTextError extends Error {
  code: string;
  row: number;
  column: number;
  constructor(code: string, row: number, column: number);
}
export function parseDelimited(text: string, delimiter: Delimiter): string[][];
export function formatMarkdown(rows: readonly (readonly string[])[], options?: FormatOptions): TableResult;
export function buildMarkdownTable(text: string, options: FormatOptions & { delimiter: Delimiter }): TableResult;
