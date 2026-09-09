export interface TableRowInput {
  readonly _key: string;
  readonly _type: string;
  readonly cells: readonly string[];
}

export interface TableRow {
  _key: string;
  _type: string;
  cells: string[];
  [key: string]: unknown;
}

export interface GridPasteOptions {
  rowType?: string;
  createKey?: () => string;
  maxRows?: number;
  maxColumns?: number;
}

/** Returns new rows without sending patches or changing the input. */
export function applyGridPaste<T extends TableRowInput>(
  rows: readonly T[],
  block: readonly (readonly string[])[],
  startRow: number,
  startColumn: number,
  options?: GridPasteOptions,
): TableRow[];
