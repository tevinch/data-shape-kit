import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><div id="root"></div>', {
  url: 'http://localhost',
});

for (const key of [
  'window',
  'document',
  'HTMLElement',
  'HTMLInputElement',
  'Node',
  'Event',
  'MutationObserver',
]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key],
    configurable: true,
  });
}
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { DemoForm } = await import('../.test-build/DemoForm.js');
const { createRenderCountStore } = await import(
  '../.test-build/render-counts.js'
);
const { createMemoFieldSet } = await import('../.test-build/MemoFieldSet.js');
const h = React.createElement;

const inputValueSetter = Object.getOwnPropertyDescriptor(
  dom.window.HTMLInputElement.prototype,
  'value',
).set;

async function renderDemo(mode) {
  const counts = createRenderCountStore();
  const root = createRoot(document.querySelector('#root'));
  await React.act(async () =>
    root.render(h(DemoForm, { mode, counts })),
  );
  return { counts, root };
}

function query(selector) {
  const element = document.querySelector(selector);
  assert.ok(element, `Expected ${selector} to exist`);
  return element;
}

async function changeInput(input, value) {
  await React.act(async () => {
    inputValueSetter.call(input, value);
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
}

async function click(element) {
  await React.act(async () => element.click());
}

async function submit(mode) {
  await React.act(async () => {
    query(`form[data-mode="${mode}"]`).dispatchEvent(
      new dom.window.Event('submit', { bubbles: true, cancelable: true }),
    );
  });
}

test('a memoized sibling stays quiet while the changed real field remains live', async () => {
  const counts = createRenderCountStore();
  const root = createRoot(document.querySelector('#root'));
  await React.act(async () =>
    root.render(h(DemoForm, { mode: 'isolated', counts })),
  );
  const input = document.querySelector(
    'input[aria-label="Isolated first name"]',
  );
  input.focus();
  const before = counts.getSnapshot()['isolated.profile.lastName'];

  for (const value of ['Adal', 'Adala']) {
    await changeInput(input, value);
  }

  assert.equal(input.value, 'Adala');
  assert.equal(
    document.querySelector('input[aria-label="Isolated first name"]'),
    input,
  );
  assert.equal(document.activeElement, input);
  assert.equal(
    counts.getSnapshot()['isolated.profile.lastName'],
    before,
  );
  await React.act(async () => root.unmount());
});

test('the original group reproduces unrelated sibling work while its summary stays reactive', async () => {
  const { counts, root } = await renderDemo('original');
  const firstName = query('input[aria-label="Original first name"]');
  const before = counts.getSnapshot();

  await changeInput(firstName, 'Adal');
  await changeInput(firstName, 'Adala');

  const after = counts.getSnapshot();
  assert.ok(
    after['original.profile.lastName'] > before['original.profile.lastName'],
  );
  assert.ok(after['original.group'] > before['original.group']);
  assert.match(query('[data-testid="original-group-value"]').textContent, /Adala/);
  await React.act(async () => root.unmount());
});

test('blur validation blocks an invalid submit and a valid submit captures current values', async () => {
  const { root } = await renderDemo('isolated');
  query('button[aria-label="Isolated: Submit"]');
  const firstName = query('input[aria-label="Isolated first name"]');
  const lastName = query('input[aria-label="Isolated last name"]');
  await changeInput(firstName, '');
  await changeInput(lastName, '');
  await React.act(async () => {
    firstName.dispatchEvent(
      new dom.window.FocusEvent('focusout', { bubbles: true }),
    );
  });

  assert.equal(
    query('[data-testid="isolated-firstName-error"]').textContent,
    'This name is required.',
  );
  assert.match(query('[data-testid="isolated-group-error"]').textContent, /at least one/i);
  await submit('isolated');
  assert.match(
    query('[data-testid="isolated-submit-result"]').textContent,
    /No successful submission/i,
  );

  await changeInput(firstName, 'Ada');
  await changeInput(lastName, 'Byron');
  await submit('isolated');
  assert.match(query('[data-testid="isolated-submit-result"]').textContent, /Submission 1/);
  assert.match(query('[data-testid="isolated-submit-result"]').textContent, /"lastName":"Byron"/);
  await React.act(async () => root.unmount());
});

test('related validation intentionally updates and clears a sibling error', async () => {
  const { counts, root } = await renderDemo('isolated');
  await click(query('input[aria-label="Isolated: Enable related validation"]'));
  const firstName = query('input[aria-label="Isolated first name"]');
  const lastName = query('input[aria-label="Isolated last name"]');

  await changeInput(lastName, 'Ada');
  assert.match(query('[data-testid="isolated-lastName-error"]').textContent, /different/i);
  const before = counts.getSnapshot()['isolated.profile.lastName'];
  await changeInput(firstName, 'Adal');

  assert.equal(query('[data-testid="isolated-lastName-error"]').textContent, '');
  assert.ok(counts.getSnapshot()['isolated.profile.lastName'] > before);
  await React.act(async () => root.unmount());
});

test('disabled definition updates reach both fields without losing values', async () => {
  const { root } = await renderDemo('isolated');
  const firstName = query('input[aria-label="Isolated first name"]');
  const lastName = query('input[aria-label="Isolated last name"]');
  await changeInput(firstName, 'Adal');
  await click(query('input[aria-label="Isolated: Disable fields"]'));

  assert.equal(firstName.disabled, true);
  assert.equal(lastName.disabled, true);
  assert.equal(firstName.value, 'Adal');
  await click(query('input[aria-label="Isolated: Disable fields"]'));
  assert.equal(firstName.disabled, false);
  assert.equal(firstName.value, 'Adal');
  await React.act(async () => root.unmount());
});

test('scope switching edits the selected object, preserves the other, and reset clears stale state', async () => {
  const { root } = await renderDemo('isolated');
  await changeInput(query('input[aria-label="Isolated first name"]'), 'Adal');
  await click(query('input[aria-label="Isolated: Use backup group"]'));
  assert.equal(query('input[aria-label="Isolated first name"]').value, 'Grace');
  await changeInput(query('input[aria-label="Isolated first name"]'), 'Gray');
  await click(query('input[aria-label="Isolated: Use backup group"]'));
  assert.equal(query('input[aria-label="Isolated first name"]').value, 'Adal');
  const profileFirstName = query('input[aria-label="Isolated first name"]');
  await changeInput(profileFirstName, '');
  await React.act(async () => {
    profileFirstName.dispatchEvent(
      new dom.window.FocusEvent('focusout', { bubbles: true }),
    );
  });
  assert.match(query('[data-testid="isolated-firstName-error"]').textContent, /required/i);
  await click(query('button[aria-label="Isolated: Reset values"]'));
  assert.equal(query('input[aria-label="Isolated first name"]').value, 'Ada');
  assert.equal(query('[data-testid="isolated-firstName-error"]').textContent, '');
  await click(query('input[aria-label="Isolated: Use backup group"]'));
  assert.equal(query('input[aria-label="Isolated first name"]').value, 'Grace');
  await React.act(async () => root.unmount());
});

test('a stable parent refresh stays outside the isolated field work', async () => {
  const { counts, root } = await renderDemo('isolated');
  const before = counts.getSnapshot();
  await click(query('button[aria-label="Isolated: Parent refresh"]'));

  assert.equal(query('[data-testid="isolated-parent-refresh"]').textContent, '1');
  assert.equal(
    counts.getSnapshot()['isolated.profile.firstName'],
    before['isolated.profile.firstName'],
  );
  assert.equal(
    counts.getSnapshot()['isolated.profile.lastName'],
    before['isolated.profile.lastName'],
  );
  await React.act(async () => root.unmount());
});

test('the reusable set respects stable props and renders intentional field changes in order', async () => {
  const FieldSet = createMemoFieldSet();
  const renders = new Map();
  function Field({ name, label }) {
    renders.set(name, (renders.get(name) ?? 0) + 1);
    return h('span', { 'data-name': name }, label);
  }
  const fields = Object.freeze([
    Object.freeze({ name: 'first', label: 'First' }),
    Object.freeze({ name: 'last', label: 'Last' }),
  ]);
  const root = createRoot(document.querySelector('#root'));
  await React.act(async () => root.render(h(FieldSet, { Field, fields })));
  const stableCounts = new Map(renders);
  await React.act(async () => root.render(h(FieldSet, { Field, fields })));
  assert.deepEqual(renders, stableCounts);

  const changedFields = Object.freeze([
    Object.freeze({ name: 'last', label: 'Family' }),
    Object.freeze({ name: 'first', label: 'Given' }),
  ]);
  await React.act(async () =>
    root.render(h(FieldSet, { Field, fields: changedFields })),
  );
  assert.equal(document.querySelector('#root').textContent, 'FamilyGiven');
  assert.equal(renders.get('first'), 2);
  assert.equal(renders.get('last'), 2);

  function AlternateField({ label }) {
    return h('strong', null, `Current ${label}`);
  }
  await React.act(async () =>
    root.render(
      h(FieldSet, {
        Field: AlternateField,
        fields: changedFields,
      }),
    ),
  );
  assert.equal(document.querySelector('#root').textContent, 'Current FamilyCurrent Given');
  await React.act(async () => root.unmount());
});

test('a definition key cannot replace name-based field identity', async () => {
  const FieldSet = createMemoFieldSet();
  function StatefulField({ name }) {
    const [mountedAs] = React.useState(name);
    return h('span', null, `${name}:${mountedAs};`);
  }
  const first = Object.freeze({ name: 'first', key: 'shared' });
  const last = Object.freeze({ name: 'last', key: 'shared' });
  const root = createRoot(document.querySelector('#root'));
  await React.act(async () =>
    root.render(
      h(FieldSet, {
        Field: StatefulField,
        fields: Object.freeze([first, last]),
      }),
    ),
  );
  await React.act(async () =>
    root.render(
      h(FieldSet, {
        Field: StatefulField,
        fields: Object.freeze([last, first]),
      }),
    ),
  );

  assert.equal(document.querySelector('#root').textContent, 'last:last;first:first;');
  await React.act(async () => root.unmount());
});

test('the reusable set accepts empty fields and rejects every malformed definition', async () => {
  const FieldSet = createMemoFieldSet();
  function Field({ name }) {
    return h('span', null, name);
  }
  const root = createRoot(document.querySelector('#root'));
  await React.act(async () =>
    root.render(h(FieldSet, { Field, fields: Object.freeze([]) })),
  );
  assert.equal(document.querySelector('#root').textContent, '');
  await React.act(async () => root.unmount());

  const malformed = [
    null,
    [null],
    [{ name: '' }],
    [{ name: 4 }],
    [{ name: 'same' }, { name: 'same' }],
  ];
  const originalError = console.error;
  console.error = () => {};
  try {
    for (const fields of malformed) {
      const container = document.createElement('div');
      document.body.append(container);
      const invalidRoot = createRoot(container);
      await assert.rejects(
        async () => {
          await React.act(async () =>
            invalidRoot.render(h(FieldSet, { Field, fields })),
          );
        },
        TypeError,
      );
      await React.act(async () => invalidRoot.unmount());
      container.remove();
    }
  } finally {
    console.error = originalError;
  }
});

test('the render-count store keeps snapshots stable and unsubscribes listeners', () => {
  const store = createRenderCountStore();
  const initial = store.getSnapshot();
  assert.equal(store.getSnapshot(), initial);
  let notifications = 0;
  const unsubscribe = store.subscribe(() => notifications++);
  store.record('isolated.profile.firstName');
  const recorded = store.getSnapshot();
  assert.notEqual(recorded, initial);
  assert.equal(recorded['isolated.profile.firstName'], 1);
  assert.equal(notifications, 1);
  store.reset();
  assert.equal(store.getSnapshot()['isolated.profile.firstName'], undefined);
  assert.equal(notifications, 2);
  unsubscribe();
  store.record('isolated.profile.firstName');
  assert.equal(notifications, 2);
});

test.after(() => dom.window.close());
