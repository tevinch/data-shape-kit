function requireNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }

  return value;
}

function requireIds(value, name = 'ids') {
  if (!Array.isArray(value)) {
    throw new TypeError(`${name} must be an array`);
  }

  const unique = new Set();
  for (const id of value) {
    unique.add(requireNonEmptyString(id, `${name} entry`));
  }

  return [...unique];
}

function requireRecord(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }

  return value;
}

function createSelection(scope, mode, ids) {
  requireNonEmptyString(scope, 'scope');
  if (mode !== 'include' && mode !== 'exclude') {
    throw new TypeError("mode must be 'include' or 'exclude'");
  }

  return Object.freeze({
    scope,
    mode,
    ids: Object.freeze(requireIds(ids)),
  });
}

function readPage(value) {
  const page = requireRecord(value, 'page');
  if (!Object.hasOwn(page, 'scope') || !Object.hasOwn(page, 'ids')) {
    throw new TypeError('page must have scope and ids');
  }

  return {
    scope: requireNonEmptyString(page.scope, 'page scope'),
    ids: requireIds(page.ids, 'page ids'),
  };
}

function assertSameScope(selection, page) {
  if (selection.scope !== page.scope) {
    throw new RangeError('selection and page scopes must match');
  }
}

function readRowMap(value) {
  const map = requireRecord(value, 'row map');
  if (Object.prototype.toString.call(map) !== '[object Object]') {
    throw new TypeError('row map must be a plain record');
  }
  for (const key of Object.getOwnPropertyNames(map)) {
    if (typeof map[key] !== 'boolean') {
      throw new TypeError('row map values must be boolean');
    }
  }

  return map;
}

export function emptySelection(scope) {
  return createSelection(scope, 'include', []);
}

export function selectAllMatching(scope) {
  return createSelection(scope, 'exclude', []);
}

export function readSelection(value) {
  const selection = requireRecord(value, 'selection');
  if (
    !Object.hasOwn(selection, 'scope')
    || !Object.hasOwn(selection, 'mode')
    || !Object.hasOwn(selection, 'ids')
  ) {
    throw new TypeError('selection must have scope, mode, and ids');
  }

  return createSelection(selection.scope, selection.mode, selection.ids);
}

export function isSelected(selection, id) {
  const current = readSelection(selection);
  const present = current.ids.includes(requireNonEmptyString(id, 'id'));

  return current.mode === 'include' ? present : !present;
}

export function setSelected(selection, ids, selected) {
  const current = readSelection(selection);
  const requestedIds = requireIds(ids);
  if (typeof selected !== 'boolean') {
    throw new TypeError('selected must be boolean');
  }

  const nextIds = new Set(current.ids);
  for (const id of requestedIds) {
    const shouldStore = current.mode === 'include' ? selected : !selected;
    if (shouldStore) {
      nextIds.add(id);
    } else {
      nextIds.delete(id);
    }
  }

  return createSelection(current.scope, current.mode, [...nextIds]);
}

export function selectedCount(selection, eligibleTotal) {
  const current = readSelection(selection);
  if (!Number.isSafeInteger(eligibleTotal) || eligibleTotal < 0) {
    throw new RangeError('eligibleTotal must be a non-negative safe integer');
  }
  if (eligibleTotal < current.ids.length) {
    throw new RangeError('eligibleTotal cannot be smaller than the stored ID count');
  }

  return current.mode === 'include'
    ? current.ids.length
    : eligibleTotal - current.ids.length;
}

export function pageSelection(selection, page) {
  const current = readSelection(selection);
  const currentPage = readPage(page);
  assertSameScope(current, currentPage);

  const storedIds = new Set(current.ids);
  const map = Object.create(null);
  for (const id of currentPage.ids) {
    const stored = storedIds.has(id);
    const selected = current.mode === 'include' ? stored : !stored;
    if (selected) {
      map[id] = true;
    }
  }

  return map;
}

export function applyPageUpdate(selection, page, updater) {
  const current = readSelection(selection);
  const currentPage = readPage(page);
  assertSameScope(current, currentPage);

  const previous = pageSelection(current, currentPage);
  const updated = typeof updater === 'function' ? updater(previous) : updater;
  const map = readRowMap(updated);
  const nextIds = new Set(current.ids);

  for (const id of currentPage.ids) {
    const selected = Object.hasOwn(map, id) && map[id] === true;
    const shouldStore = current.mode === 'include' ? selected : !selected;
    if (shouldStore) {
      nextIds.add(id);
    } else {
      nextIds.delete(id);
    }
  }

  return createSelection(current.scope, current.mode, [...nextIds]);
}
