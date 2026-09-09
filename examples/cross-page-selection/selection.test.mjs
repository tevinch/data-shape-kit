import assert from 'node:assert/strict';
import test from 'node:test';

let selectionModule;

try {
  selectionModule = await import('./selection.mjs');
} catch (error) {
  if (error?.code !== 'ERR_MODULE_NOT_FOUND') {
    throw error;
  }

  selectionModule = {};
}

test('exports the complete selection contract', () => {
  assert.deepEqual(Object.keys(selectionModule).sort(), [
    'applyPageUpdate',
    'emptySelection',
    'isSelected',
    'pageSelection',
    'readSelection',
    'selectAllMatching',
    'selectedCount',
    'setSelected',
  ]);
});

const {
  applyPageUpdate,
  emptySelection,
  isSelected,
  pageSelection,
  readSelection,
  selectAllMatching,
  selectedCount,
  setSelected,
} = selectionModule;

test('creates frozen include and exclude descriptors', () => {
  const empty = emptySelection('catalog-v1:all');
  const all = selectAllMatching('catalog-v1:all');

  assert.deepEqual(empty, {
    scope: 'catalog-v1:all',
    mode: 'include',
    ids: [],
  });
  assert.deepEqual(all, {
    scope: 'catalog-v1:all',
    mode: 'exclude',
    ids: [],
  });
  assert.ok(Object.isFrozen(empty));
  assert.ok(Object.isFrozen(empty.ids));
  assert.ok(Object.isFrozen(all));
  assert.ok(Object.isFrozen(all.ids));
});

test('reads JSON data into a deduplicated frozen descriptor without aliasing', () => {
  const ids = ['b', 'a', 'b'];
  const value = {scope: 'catalog-v1:all', mode: 'include', ids};
  const selection = readSelection(value);

  ids.push('later');
  value.scope = 'changed';

  assert.deepEqual(selection, {
    scope: 'catalog-v1:all',
    mode: 'include',
    ids: ['b', 'a'],
  });
  assert.ok(Object.isFrozen(selection));
  assert.ok(Object.isFrozen(selection.ids));
  assert.deepEqual(readSelection(JSON.parse(JSON.stringify(selection))), selection);
});

test('rejects empty or malformed scopes, IDs, and state', () => {
  for (const scope of ['', null, 7]) {
    assert.throws(() => emptySelection(scope), TypeError);
    assert.throws(() => selectAllMatching(scope), TypeError);
  }

  for (const value of [
    null,
    [],
    {},
    {scope: 's', mode: 'include'},
    {scope: 's', mode: 'include', ids: 'a'},
    {scope: 's', mode: 'unknown', ids: []},
    {scope: '', mode: 'include', ids: []},
    {scope: 's', mode: 'include', ids: ['']},
    {scope: 's', mode: 'include', ids: [1]},
    Object.create({scope: 's', mode: 'include', ids: []}),
  ]) {
    assert.throws(() => readSelection(value), TypeError);
  }
});

test('sets IDs according to include or exclude mode and preserves prior snapshots', () => {
  const include0 = emptySelection('s');
  const include1 = setSelected(include0, ['a', 'a', 'b'], true);
  const include2 = setSelected(include1, ['a'], false);

  assert.deepEqual(include0.ids, []);
  assert.deepEqual(include1.ids, ['a', 'b']);
  assert.deepEqual(include2.ids, ['b']);

  const exclude0 = selectAllMatching('s');
  const exclude1 = setSelected(exclude0, ['a', 'a', 'b'], false);
  const exclude2 = setSelected(exclude1, ['a'], true);

  assert.deepEqual(exclude0.ids, []);
  assert.deepEqual(exclude1.ids, ['a', 'b']);
  assert.deepEqual(exclude2.ids, ['b']);
  assert.ok(Object.isFrozen(include2));
  assert.ok(Object.isFrozen(include2.ids));
});

test('validates setSelected arguments', () => {
  const selection = emptySelection('s');

  assert.throws(() => setSelected(selection, 'a', true), TypeError);
  assert.throws(() => setSelected(selection, [''], true), TypeError);
  assert.throws(() => setSelected(selection, [1], true), TypeError);
  assert.throws(() => setSelected(selection, ['a'], 1), TypeError);
  assert.throws(
    () => setSelected({scope: 's', mode: 'include', ids: 'a'}, ['a'], true),
    TypeError,
  );
});

test('checks membership and counts include and exclude descriptors', () => {
  const include = setSelected(emptySelection('s'), ['a', 'b'], true);
  const exclude = setSelected(selectAllMatching('s'), ['d'], false);

  assert.equal(isSelected(include, 'a'), true);
  assert.equal(isSelected(include, 'unseen'), false);
  assert.equal(selectedCount(include, 4), 2);
  assert.equal(isSelected(exclude, 'a'), true);
  assert.equal(isSelected(exclude, 'd'), false);
  assert.equal(selectedCount(exclude, 4), 3);
});

test('rejects invalid membership IDs and eligible totals', () => {
  const include = setSelected(emptySelection('s'), ['a', 'b'], true);

  assert.throws(() => isSelected(include, ''), TypeError);
  assert.throws(() => isSelected(include, 1), TypeError);
  for (const total of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, '2']) {
    assert.throws(() => selectedCount(include, total), RangeError);
  }
  assert.throws(() => selectedCount(include, 1), RangeError);
});

test('derives a null-prototype page map with own true properties only', () => {
  const selection = setSelected(emptySelection('s'), ['__proto__', 'constructor', 'off'], true);
  const map = pageSelection(selection, {
    scope: 's',
    ids: ['missing', '__proto__', 'constructor', '__proto__'],
  });

  assert.equal(Object.getPrototypeOf(map), null);
  assert.deepEqual(Object.keys(map), ['__proto__', 'constructor']);
  assert.equal(Object.hasOwn(map, '__proto__'), true);
  assert.equal(map.__proto__, true);
  assert.equal(map.constructor, true);
  assert.equal(Object.hasOwn(map, 'missing'), false);
  assert.equal(Object.hasOwn(map, 'off'), false);
});

test('rejects malformed pages and scope mismatches', () => {
  const selection = emptySelection('s');

  assert.throws(() => pageSelection(selection, null), TypeError);
  assert.throws(() => pageSelection(selection, {scope: 's', ids: 'a'}), TypeError);
  assert.throws(() => pageSelection(selection, {scope: 's', ids: ['']}), TypeError);
  assert.throws(() => pageSelection(selection, {scope: 'other', ids: ['a']}), RangeError);
});

test('keeps selections across pages for value updaters', () => {
  const a = {scope: 'catalog-v1:all', ids: ['a', 'b']};
  const b = {scope: a.scope, ids: ['c', 'd']};
  let selected = applyPageUpdate(emptySelection(a.scope), a, {a: true});

  selected = applyPageUpdate(selected, b, {d: true});

  assert.deepEqual([...selected.ids].sort(), ['a', 'd']);

  let all = selectAllMatching(a.scope);
  assert.equal(isSelected(all, 'unseen'), true);
  all = applyPageUpdate(all, b, {c: true});
  assert.deepEqual(all.ids, ['d']);
  assert.equal(selectedCount(all, 4), 3);
  assert.equal(isSelected(all, 'a'), true);
  assert.equal(isSelected(all, 'd'), false);
  assert.throws(() => pageSelection(all, {scope: 'other', ids: ['a']}), RangeError);
});

test('passes an isolated page map to function updaters', () => {
  const initial = setSelected(emptySelection('s'), ['a', 'off'], true);
  let received;
  const next = applyPageUpdate(initial, {scope: 's', ids: ['a', 'b']}, (previous) => {
    received = previous;
    assert.equal(Object.getPrototypeOf(previous), null);
    assert.deepEqual(Object.keys(previous), ['a']);
    previous.a = false;
    previous.b = true;
    return previous;
  });

  received.off = false;
  received.b = false;

  assert.deepEqual(initial.ids, ['a', 'off']);
  assert.deepEqual(next.ids, ['off', 'b']);
});

test('page updates change only page IDs and ignore inherited or unknown keys', () => {
  const initial = setSelected(emptySelection('s'), ['a', 'off'], true);
  const update = Object.create({a: true, inherited: true});
  update.unknown = true;

  const next = applyPageUpdate(initial, {scope: 's', ids: ['a', 'b']}, update);

  assert.deepEqual(next.ids, ['off']);
  assert.equal(isSelected(next, 'unknown'), false);
  assert.equal(isSelected(next, 'inherited'), false);
});

test('supports repeated page IDs and empty pages without mutating snapshots', () => {
  const initial = setSelected(emptySelection('s'), ['a', 'off'], true);
  const page = {scope: 's', ids: ['a', 'a', 'b']};
  const next = applyPageUpdate(initial, page, {a: true, b: true});
  page.ids.push('later');
  const unchanged = applyPageUpdate(next, {scope: 's', ids: []}, {});

  assert.deepEqual(initial.ids, ['a', 'off']);
  assert.deepEqual(next.ids, ['a', 'off', 'b']);
  assert.deepEqual(unchanged, next);
  assert.notEqual(unchanged, next);
  assert.notEqual(unchanged.ids, next.ids);
});

test('rejects invalid page updater values and outputs', () => {
  const selection = emptySelection('s');
  const page = {scope: 's', ids: ['a']};

  for (const updater of [null, [], 'yes', {a: 1}]) {
    assert.throws(() => applyPageUpdate(selection, page, updater), TypeError);
  }
  assert.throws(() => applyPageUpdate(selection, page, () => null), TypeError);
  assert.throws(() => applyPageUpdate(selection, page, () => ({a: 'yes'})), TypeError);
  assert.throws(() => applyPageUpdate(selection, page, async () => ({a: true})), TypeError);
});

test('matches a separate explicit Set through a deterministic sequence', () => {
  const universe = ['a', 'b', 'c', 'd'];
  let descriptor = emptySelection('s');
  let explicit = new Set();

  descriptor = setSelected(descriptor, ['a', 'c'], true);
  explicit = new Set(['a', 'c']);
  assert.deepEqual(universe.map((id) => isSelected(descriptor, id)), [true, false, true, false]);
  assert.equal(selectedCount(descriptor, universe.length), explicit.size);

  descriptor = applyPageUpdate(descriptor, {scope: 's', ids: ['b', 'c']}, {b: true});
  explicit = new Set(['a', 'b']);
  assert.deepEqual(universe.map((id) => isSelected(descriptor, id)), [true, true, false, false]);
  assert.equal(selectedCount(descriptor, universe.length), explicit.size);

  descriptor = selectAllMatching('s');
  explicit = new Set(universe);
  descriptor = setSelected(descriptor, ['b', 'd'], false);
  explicit = new Set(['a', 'c']);
  assert.deepEqual(universe.map((id) => isSelected(descriptor, id)), [true, false, true, false]);
  assert.equal(selectedCount(descriptor, universe.length), explicit.size);

  descriptor = applyPageUpdate(descriptor, {scope: 's', ids: ['b', 'c']}, {b: true, c: true});
  explicit = new Set(['a', 'b', 'c']);
  assert.deepEqual(universe.map((id) => isSelected(descriptor, id)), [true, true, true, false]);
  assert.equal(selectedCount(descriptor, universe.length), explicit.size);
});
