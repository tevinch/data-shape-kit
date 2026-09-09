// Copyright (c) 2026 Tevinch. SPDX-License-Identifier: MIT
export interface PasteEvent {
  readonly defaultPrevented: boolean;
  readonly cancelable: boolean;
  readonly target: EventTarget | null;
  readonly clipboardData: Pick<DataTransfer, 'types' | 'getData'> | null;
  preventDefault(): void;
  stopPropagation(): void;
}
export interface PasteBatch {
  target: [column: number, row: number];
  values: string[][];
}
export function readPlainTextPaste(event: PasteEvent, target: readonly [column: number, row: number] | undefined): PasteBatch | undefined;
