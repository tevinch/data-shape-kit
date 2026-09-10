import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';

import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
});

Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  Node: dom.window.Node,
  Element: dom.window.Element,
  HTMLElement: dom.window.HTMLElement,
  HTMLInputElement: dom.window.HTMLInputElement,
  Event: dom.window.Event,
  MouseEvent: dom.window.MouseEvent,
  KeyboardEvent: dom.window.KeyboardEvent,
  FocusEvent: dom.window.FocusEvent,
  MutationObserver: dom.window.MutationObserver,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: dom.window.navigator,
});

dom.window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};

const React = await import('react');
const { act } = React;
const { createRoot } = await import('react-dom/client');
const { EditableTagSelect } = await import(
  '../.test-build/EditableTagSelect.js'
);

const mounted = new Set();

afterEach(async () => {
  for (const item of mounted) {
    await act(async () => item.root.unmount());
    item.container.remove();
  }
  mounted.clear();
  document.body.replaceChildren();
});

async function mountEditable({
  initial = [
    { id: 'a', text: 'Import guid' },
    { id: 'b', text: 'CSV checks' },
  ],
  createId = () => 'created-tag',
  disabled = false,
  inputId = 'tags',
} = {}) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const events = [];
  let value = initial;
  let isDisabled = disabled;

  const render = () => {
    root.render(
      React.createElement(EditableTagSelect, {
        value,
        inputId,
        label: 'Project tags',
        isDisabled,
        createId,
        onChange(next) {
          events.push(next);
          value = next;
          render();
        },
      }),
    );
  };

  await act(async () => render());
  const item = {
    root,
    container,
    events,
    get value() {
      return value;
    },
    async externalUpdate(next) {
      value = next;
      await act(async () => render());
    },
    async setDisabled(next) {
      isDisabled = next;
      await act(async () => render());
    },
  };
  mounted.add(item);
  return item;
}

function editButton(text) {
  return document.querySelector(`button[aria-label="Edit tag: ${text}"]`);
}

function editorInput() {
  return document.querySelector('#tags-tag-editor');
}

function selectInput() {
  return document.querySelector('#tags');
}

async function click(element) {
  assert.ok(element, 'expected an element to click');
  await act(async () => element.click());
}

async function setInput(element, value) {
  const setter = Object.getOwnPropertyDescriptor(
    dom.window.HTMLInputElement.prototype,
    'value',
  ).set;
  await act(async () => {
    setter.call(element, value);
    element.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
}

async function keyDown(element, key, properties = {}) {
  await act(async () => {
    const event = new dom.window.KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
    });
    for (const [name, value] of Object.entries(properties)) {
      Object.defineProperty(event, name, { configurable: true, value });
    }
    element.dispatchEvent(event);
  });
}

test('1: edits the full tag text once, preserves identity and peers, then restores focus', async () => {
  const peer = { id: 'b', text: 'CSV checks' };
  const app = await mountEditable({
    initial: [{ id: 'a', text: 'Import guid' }, peer],
  });

  await click(editButton('Import guid'));
  const input = editorInput();
  assert.ok(input);
  assert.equal(document.querySelector('label[for="tags-tag-editor"]').textContent, 'Tag text');
  assert.equal(input.value, 'Import guid');
  assert.equal(document.activeElement, input);
  assert.equal(input.selectionStart, 0);
  assert.equal(input.selectionEnd, 'Import guid'.length);

  await setInput(input, 'Import guide');
  await click(document.querySelector('button[type="button"][data-action="save-tag"]'));

  assert.equal(app.events.length, 1);
  assert.equal(app.value[0].id, 'a');
  assert.equal(app.value[0].text, 'Import guide');
  assert.equal(app.value[1], peer);
  assert.equal(document.activeElement, editButton('Import guide'));
});

test('2: blank and duplicate errors retain the draft without emitting, then a valid retry succeeds', async () => {
  const app = await mountEditable();
  await click(editButton('Import guid'));
  const input = editorInput();

  await setInput(input, '   ');
  await click(document.querySelector('[data-action="save-tag"]'));
  assert.equal(app.events.length, 0);
  assert.equal(input.value, '   ');
  assert.match(document.querySelector('[role="alert"]').textContent, /enter a tag/i);
  assert.equal(input.getAttribute('aria-invalid'), 'true');
  assert.equal(input.getAttribute('aria-describedby'), 'tags-tag-error');

  await setInput(input, ' csv CHECKS ');
  await click(document.querySelector('[data-action="save-tag"]'));
  assert.equal(app.events.length, 0);
  assert.equal(input.value, ' csv CHECKS ');
  assert.match(document.querySelector('[role="alert"]').textContent, /already exists/i);

  await setInput(input, 'Import guide');
  await click(document.querySelector('[data-action="save-tag"]'));
  assert.equal(app.events.length, 1);
  assert.equal(app.value[0].text, 'Import guide');
});

test('3: cancel, Escape, blur, and Backspace preserve values while Enter saves once', async () => {
  const app = await mountEditable();

  await click(editButton('Import guid'));
  await setInput(editorInput(), 'Canceled');
  await click(document.querySelector('[data-action="cancel-edit"]'));
  assert.equal(app.events.length, 0);
  assert.equal(app.value[0].text, 'Import guid');
  assert.equal(document.activeElement, editButton('Import guid'));

  await click(editButton('Import guid'));
  await setInput(editorInput(), 'Escaped');
  await keyDown(editorInput(), 'Escape');
  assert.equal(app.events.length, 0);
  assert.equal(editorInput(), null);

  await click(editButton('Import guid'));
  await setInput(editorInput(), 'Import guide');
  await act(async () => editorInput().blur());
  assert.ok(editorInput());
  await keyDown(editorInput(), 'Backspace');
  assert.equal(app.events.length, 0);
  assert.equal(document.querySelectorAll('[aria-label^="Remove "]').length, 0);
  await keyDown(editorInput(), 'Enter');
  assert.equal(app.events.length, 1);
  assert.equal(app.value[0].text, 'Import guide');
});

test('4: composition Enter does not save, then ordinary Enter saves once', async () => {
  const app = await mountEditable();
  await click(editButton('Import guid'));
  await setInput(editorInput(), 'Import guide');

  await keyDown(editorInput(), 'Enter', { isComposing: true });
  assert.equal(app.events.length, 0);
  assert.ok(editorInput());
  await keyDown(editorInput(), 'Enter', { keyCode: 229 });
  assert.equal(app.events.length, 0);
  assert.ok(editorInput());

  await keyDown(editorInput(), 'Enter');
  assert.equal(app.events.length, 1);
  assert.equal(app.value[0].text, 'Import guide');
});

test('5: current parent data is preserved and stale or removed targets are not overwritten', async () => {
  const app = await mountEditable();
  await click(editButton('Import guid'));
  await setInput(editorInput(), 'Import guide');
  const updatedPeer = { id: 'b', text: 'Updated elsewhere' };
  await app.externalUpdate([{ id: 'a', text: 'Import guid' }, updatedPeer]);
  assert.equal(editorInput().value, 'Import guide');
  await click(document.querySelector('[data-action="save-tag"]'));
  assert.equal(app.events.length, 1);
  assert.equal(app.value[1], updatedPeer);

  const conflict = await mountEditable({ inputId: 'conflict-tags' });
  await click(conflict.container.querySelector('[aria-label="Edit tag: Import guid"]'));
  await setInput(
    conflict.container.querySelector('#conflict-tags-tag-editor'),
    'Import guide',
  );
  await conflict.externalUpdate([
    { id: 'a', text: 'Changed elsewhere' },
    { id: 'b', text: 'CSV checks' },
  ]);
  await click(conflict.container.querySelector('[data-action="save-tag"]'));
  assert.equal(conflict.events.length, 0);
  assert.equal(
    conflict.container.querySelector('#conflict-tags-tag-editor').value,
    'Import guide',
  );
  assert.match(conflict.container.querySelector('[role="alert"]').textContent, /changed elsewhere/i);

  const missing = await mountEditable({ inputId: 'missing-tags' });
  await click(missing.container.querySelector('[aria-label="Edit tag: Import guid"]'));
  await setInput(
    missing.container.querySelector('#missing-tags-tag-editor'),
    'Import guide',
  );
  await missing.externalUpdate([{ id: 'b', text: 'CSV checks' }]);
  await click(missing.container.querySelector('[data-action="save-tag"]'));
  assert.equal(missing.events.length, 0);
  assert.deepEqual(missing.value, [{ id: 'b', text: 'CSV checks' }]);
  assert.match(missing.container.querySelector('[role="alert"]').textContent, /removed/i);
  await click(missing.container.querySelector('[data-action="cancel-edit"]'));
  assert.equal(document.activeElement, missing.container.querySelector('#missing-tags'));
});

test('6: external disabling retains the draft, blocks Save and new actions, and permits Cancel', async () => {
  const app = await mountEditable();
  await click(editButton('Import guid'));
  await setInput(editorInput(), 'Import guide');
  await app.setDisabled(true);

  assert.equal(editorInput().value, 'Import guide');
  assert.equal(editorInput().disabled, true);
  assert.equal(document.querySelector('[data-action="save-tag"]').disabled, true);
  assert.equal(document.querySelector('[data-action="cancel-edit"]').disabled, false);
  await click(document.querySelector('[data-action="save-tag"]'));
  assert.equal(app.events.length, 0);
  await click(document.querySelector('[data-action="cancel-edit"]'));
  assert.equal(editorInput(), null);

  assert.equal(editButton('Import guid').disabled, true);
  await click(editButton('Import guid'));
  assert.equal(editorInput(), null);
  assert.equal(selectInput().disabled, true);
});

test('7: actual Creatable creation and normal removal each emit one controlled update', async () => {
  let ids = 0;
  const app = await mountEditable({ createId: () => `created-${++ids}` });
  const input = selectInput();
  await act(async () => input.focus());
  await setInput(input, 'New tag');

  const candidate = [...document.querySelectorAll('[role="option"]')].find(
    (option) => option.textContent === 'Create "New tag"',
  );
  await click(candidate);

  assert.equal(app.events.length, 1);
  assert.deepEqual(app.value.at(-1), { id: 'created-1', text: 'New tag' });
  assert.equal(app.value.some((tag) => tag.id === ''), false);
  assert.equal(ids, 1);

  await click(document.querySelector('[aria-label="Remove CSV checks"]'));
  assert.equal(app.events.length, 2);
  assert.deepEqual(
    app.value.map((tag) => tag.id),
    ['a', 'created-1'],
  );
});
