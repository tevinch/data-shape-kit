export interface Selection {
  readonly scope: string;
  readonly mode: 'include' | 'exclude';
  readonly ids: readonly string[];
}

export interface Page {
  readonly scope: string;
  readonly ids: readonly string[];
}

export type RowMap = Record<string, boolean>;

export function emptySelection(scope: string): Selection;
export function selectAllMatching(scope: string): Selection;
export function readSelection(value: unknown): Selection;
export function isSelected(selection: Selection, id: string): boolean;
export function setSelected(
  selection: Selection,
  ids: readonly string[],
  selected: boolean,
): Selection;
export function selectedCount(selection: Selection, eligibleTotal: number): number;
export function pageSelection(selection: Selection, page: Page): Record<string, true>;
export function applyPageUpdate(
  selection: Selection,
  page: Page,
  updater: RowMap | ((previous: Record<string, true>) => RowMap),
): Selection;
