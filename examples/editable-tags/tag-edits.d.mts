export type Tag = Readonly<{ id: string; text: string }>;
export type TagEdit = Readonly<{
  id: string;
  originalText: string;
  draft: string;
}>;
export type TagEditFailure =
  | 'blank'
  | 'duplicate'
  | 'duplicate-id'
  | 'missing'
  | 'conflict';
export type TagEditResult =
  | { ok: true; value: readonly Tag[]; changed: boolean }
  | { ok: false; reason: TagEditFailure; message: string };

export function commitTagEdit(
  value: readonly Tag[],
  edit: TagEdit,
): TagEditResult;
export function appendTag(
  value: readonly Tag[],
  id: string,
  text: string,
): TagEditResult;
