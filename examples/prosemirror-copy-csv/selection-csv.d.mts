import type { Node } from '@tiptap/pm/model';
import type { Selection } from '@tiptap/pm/state';

export const CSV_LIMITS: Readonly<{ maxRows: 1000; maxColumns: 64; maxChars: 100000 }>;
export class SelectionCsvError extends Error {
  readonly code: string;
  readonly row: number;
  readonly column: number;
  constructor(code: string, row?: number, column?: number);
}
export interface CsvOptions {
  readCell?: (cell: Node, coordinate: { row: number; column: number }) => string;
}
export function selectionToCsv(selection: Selection, options?: CsvOptions): string | undefined;
