const BLANK_MESSAGE = 'Enter a tag before saving.';
const DUPLICATE_MESSAGE = 'A tag with that text already exists.';
const DUPLICATE_ID_MESSAGE = 'That tag identifier is already in use.';
const MISSING_MESSAGE = 'This tag was removed. Cancel and reopen an existing tag.';
const CONFLICT_MESSAGE =
  'This tag changed elsewhere. Cancel and reopen it to use the latest text.';

function validateTags(value) {
  if (!Array.isArray(value)) {
    throw new TypeError('Tag value must be an array.');
  }

  const ids = new Set();
  for (const tag of value) {
    if (tag === null || typeof tag !== 'object' || Array.isArray(tag)) {
      throw new TypeError('Every tag must be an object.');
    }
    if (typeof tag.id !== 'string' || tag.id.length === 0) {
      throw new TypeError('Every tag ID must be a nonempty string.');
    }
    if (typeof tag.text !== 'string') {
      throw new TypeError('Every tag text must be a string.');
    }
    if (ids.has(tag.id)) {
      throw new TypeError('Tag IDs must be unique.');
    }
    ids.add(tag.id);
  }
}

function validateEdit(edit) {
  if (edit === null || typeof edit !== 'object' || Array.isArray(edit)) {
    throw new TypeError('Tag edit must be an object.');
  }
  if (typeof edit.id !== 'string' || edit.id.length === 0) {
    throw new TypeError('Tag edit ID must be a nonempty string.');
  }
  if (typeof edit.originalText !== 'string') {
    throw new TypeError('Original tag text must be a string.');
  }
  if (typeof edit.draft !== 'string') {
    throw new TypeError('Draft tag text must be a string.');
  }
}

function normalizedText(text) {
  return text.trim().toLowerCase();
}

function validateNewText(value, text, excludedId) {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: 'blank', message: BLANK_MESSAGE };
  }

  const normalized = normalizedText(trimmed);
  if (
    value.some(
      (tag) => tag.id !== excludedId && normalizedText(tag.text) === normalized,
    )
  ) {
    return { ok: false, reason: 'duplicate', message: DUPLICATE_MESSAGE };
  }

  return { ok: true, text: trimmed };
}

export function commitTagEdit(value, edit) {
  validateTags(value);
  validateEdit(edit);

  const index = value.findIndex((tag) => tag.id === edit.id);
  if (index === -1) {
    return { ok: false, reason: 'missing', message: MISSING_MESSAGE };
  }

  const current = value[index];
  if (current.text !== edit.originalText) {
    return { ok: false, reason: 'conflict', message: CONFLICT_MESSAGE };
  }

  const textResult = validateNewText(value, edit.draft, edit.id);
  if (!textResult.ok) {
    return textResult;
  }

  if (textResult.text === current.text) {
    return { ok: true, value, changed: false };
  }

  const next = value.slice();
  next[index] = { ...current, text: textResult.text };
  return { ok: true, value: next, changed: true };
}

export function appendTag(value, id, text) {
  validateTags(value);
  if (typeof id !== 'string' || id.length === 0) {
    throw new TypeError('New tag ID must be a nonempty string.');
  }
  if (typeof text !== 'string') {
    throw new TypeError('New tag text must be a string.');
  }
  if (value.some((tag) => tag.id === id)) {
    return {
      ok: false,
      reason: 'duplicate-id',
      message: DUPLICATE_ID_MESSAGE,
    };
  }

  const textResult = validateNewText(value, text);
  if (!textResult.ok) {
    return textResult;
  }

  return {
    ok: true,
    value: [...value, { id, text: textResult.text }],
    changed: true,
  };
}
