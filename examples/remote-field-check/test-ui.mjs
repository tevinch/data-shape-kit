import test, { before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const bundle = new URL(`./.ui-test-${process.pid}.mjs`, import.meta.url);
let React, act, createRoot, SlugFormExample, validateSlug, useRemoteCheckController, useRemoteCheckState;
let dom, root, container;
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
before(async () => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
  for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'Event', 'MouseEvent', 'Node']) {
    globalThis[key] = dom.window[key];
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  await build({
    stdin: { contents: 'export * from "./slug-form-example.tsx"; export * from "./use-remote-check.ts";', resolveDir: fileURLToPath(new URL('.', import.meta.url)), loader: 'ts' },
    outfile: fileURLToPath(bundle), bundle: true, platform: 'node', format: 'esm', jsx: 'automatic',
    packages: 'external',
  });
  React = await import('react');
  ({ act } = React);
  ({ createRoot } = await import('react-dom/client'));
  ({ SlugFormExample, validateSlug, useRemoteCheckController, useRemoteCheckState } = await import(bundle.href));
});
afterEach(async () => {
  if (root) await act(async () => { root.unmount(); });
  root = undefined;
  container?.remove();
});
after(async () => {
  dom?.window.close();
  await unlink(fileURLToPath(bundle)).catch(() => {});
  for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'Event', 'MouseEvent', 'Node', 'IS_REACT_ACT_ENVIRONMENT']) delete globalThis[key];
});
async function render(props, strict = false) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  const component = React.createElement(SlugFormExample, props);
  await act(async () => { root.render(strict ? React.createElement(React.StrictMode, null, component) : component); });
}
async function input(name, value) {
  const element = container.querySelector(`input[name="${name}"]`);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function submit() {
  await act(async () => {
    container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}
async function reset() {
  const button = [...container.querySelectorAll('button')].find((element) => element.textContent === 'Reset');
  await act(async () => { button.click(); });
}
const content = () => container.textContent;

test('stores input immediately and submit flushes debounce with latest slug and note', async () => {
  const work = deferred();
  const checked = [], accepted = [];
  await render({ check: (value) => { checked.push(value); return work.promise; }, onAccepted: (values) => { accepted.push(values); }, delayMs: 60000 });
  await input('slug', 'first-slug');
  await input('slug', 'latest-slug');
  await input('note', 'A local note');
  assert.deepEqual(checked, []);
  await submit();
  assert.deepEqual(checked, ['latest-slug']);
  assert.equal(container.querySelector('fieldset').disabled, true);
  assert.deepEqual(accepted, []);
  await act(async () => { work.resolve(null); });
  assert.deepEqual(accepted, [{ slug: 'latest-slug', note: 'A local note' }]);
  assert.equal(container.querySelector('fieldset').disabled, false);
  await submit();
  assert.deepEqual(checked, ['latest-slug', 'latest-slug']);
});

test('unrelated note edits do not start or reschedule remote checks', async () => {
  const checked = [];
  await render({ check: (value) => { checked.push(value); return null; }, onAccepted() {}, delayMs: 60000 });
  await input('note', 'note only');
  assert.deepEqual(checked, []);
  await input('slug', 'usable');
  await submit();
  assert.deepEqual(checked, ['usable']);
  await input('note', 'another note');
  assert.deepEqual(checked, ['usable']);
});

test('local rules block remote work and acceptance, with local errors taking precedence', async () => {
  const checked = [], accepted = [];
  await render({ check: (value) => { checked.push(value); return 'Already used'; }, onAccepted: (value) => accepted.push(value), delayMs: 60000 });
  await input('slug', 'usable');
  await submit();
  assert.match(content(), /Already used/);
  for (const value of ['ab', 'Uppercase', '-leading', 'trailing-', 'has space', 'a'.repeat(33)]) {
    await input('slug', value);
    await submit();
    assert.doesNotMatch(content(), /Already used/);
    assert.match(content(), /3.?32|lowercase/);
  }
  assert.deepEqual(checked, ['usable']);
  assert.deepEqual(accepted, []);
});

for (const kind of ['invalid', 'throw', 'rejection', 'malformed']) {
  test(`${kind} remote outcome blocks acceptance and hides exception details`, async () => {
    const accepted = [];
    const check = () => {
      if (kind === 'invalid') return 'Already used';
      if (kind === 'throw') throw new Error('secret-database-host');
      if (kind === 'rejection') return Promise.reject(new Error('secret-database-host'));
      return false;
    };
    await render({ check, onAccepted: (value) => accepted.push(value), delayMs: 60000 });
    await input('slug', 'usable');
    await submit();
    assert.deepEqual(accepted, []);
    assert.doesNotMatch(content(), /secret-database-host/);
    assert.match(content(), kind === 'invalid' ? /Already used/ : /could not|couldn.t|Unable|unavailable/i);
    assert.equal(container.querySelector('fieldset').disabled, false);
  });
}

test('stale ignored-abort result after input replacement never appears or accepts', async () => {
  const old = deferred(), latest = deferred();
  const checked = [], accepted = [];
  await render({ check: (value) => { checked.push(value); return value === 'first' ? old.promise : latest.promise; }, onAccepted: (value) => accepted.push(value), delayMs: 60000 });
  await input('slug', 'first');
  await submit();
  // Dispatching simulates an external value edit even during disabled submission.
  await input('slug', 'second');
  await act(async () => { old.resolve('Outdated error'); });
  assert.doesNotMatch(content(), /Outdated error/);
  assert.deepEqual(accepted, []);
  await submit();
  await act(async () => { latest.resolve(null); });
  assert.deepEqual(accepted, [{ slug: 'second', note: '' }]);
});

test('reset cancels pending checks and removes remote/local status', async () => {
  const checked = [];
  await render({ check: (value) => { checked.push(value); return 'Already used'; }, onAccepted() {}, delayMs: 60000 });
  await input('slug', 'usable');
  await reset();
  assert.equal(container.querySelector('input[name="slug"]').value, '');
  assert.doesNotMatch(content(), /Waiting|Checking|Already used/);
  await submit();
  assert.deepEqual(checked, []);
});

test('acceptance callback failures are visible without exposing thrown details', async () => {
  await render({ check: () => null, onAccepted() { throw new Error('secret-service-url'); }, delayMs: 60000 });
  await input('slug', 'usable');
  await submit();
  assert.doesNotMatch(content(), /secret-service-url/);
  assert.match(content(), /could not|couldn.t|Unable/i);
  assert.equal(container.querySelector('fieldset').disabled, false);
});

test('StrictMode cleanup cancels ignored-abort work while keeping controller reusable', async () => {
  let controller;
  const work = deferred();
  let signal;
  const check = (_, context) => { signal = context.signal; return work.promise; };
  function Harness() {
    controller = useRemoteCheckController(check);
    const state = useRemoteCheckState(controller);
    return React.createElement('output', null, state.status);
  }
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
  await act(async () => { root.render(React.createElement(React.StrictMode, null, React.createElement(Harness))); });
  let promise;
  await act(async () => { promise = controller.checkNow('usable'); });
  assert.equal(content(), 'checking');
  await act(async () => { root.unmount(); }); root = undefined;
  assert.equal(signal.aborted, true);
  assert.equal((await promise).status, 'cancelled');
  work.resolve(null);
  await act(async () => { await Promise.resolve(); });
  assert.equal(controller.getSnapshot().status, 'idle');
});

test('changing checker cancels the previous controller and exposes only current state', async () => {
  let controller;
  let oldSignal;
  const oldCheck = (_, { signal }) => { oldSignal = signal; return new Promise(() => {}); };
  function Harness({ check }) {
    controller = useRemoteCheckController(check);
    return React.createElement('output', null, useRemoteCheckState(controller).status);
  }
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
  await act(async () => { root.render(React.createElement(Harness, { check: oldCheck })); });
  let old;
  await act(async () => { old = controller.checkNow('usable'); });
  await act(async () => { root.render(React.createElement(Harness, { check: () => null })); });
  assert.equal(oldSignal.aborted, true);
  assert.equal((await old).status, 'cancelled');
  assert.equal(content(), 'idle');
  await act(async () => { await controller.checkNow('usable'); });
  assert.equal(content(), 'valid');
});


test('timeout releases submission and shows a fixed retry message', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  const accepted = [];
  await render({ check: (_, context) => { signal = context.signal; return new Promise(() => {}); }, onAccepted: (value) => accepted.push(value), delayMs: 60000, timeoutMs: 100 });
  await input('slug', 'usable');
  await submit();
  assert.equal(container.querySelector('fieldset').disabled, true);
  await act(async () => { t.mock.timers.tick(100); });
  assert.equal(signal.aborted, true);
  assert.equal(container.querySelector('fieldset').disabled, false);
  assert.deepEqual(accepted, []);
  assert.match(content(), /Could not check/);
});

test('reset aborts a running change check even when its callback ignores the signal', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const work = deferred();
  let signal;
  await render({ check: (_, context) => { signal = context.signal; return work.promise; }, onAccepted() {}, delayMs: 100 });
  await input('slug', 'usable');
  await act(async () => { t.mock.timers.tick(100); });
  assert.equal(signal.aborted, false);
  await reset();
  assert.equal(signal.aborted, true);
  await act(async () => { work.resolve('Outdated reset error'); });
  assert.doesNotMatch(content(), /Outdated reset error|Checking|Waiting/);
  assert.equal(container.querySelector('input[name="slug"]').value, '');
});

test('StrictMode effect replay cancels first setup work and can start new work', async () => {
  const outcomes = [], signals = [];
  let controller;
  const work = deferred();
  const check = (_, { signal }) => { signals.push(signal); return work.promise; };
  function Harness() {
    controller = useRemoteCheckController(check);
    React.useEffect(() => { outcomes.push(controller.checkNow('usable')); }, [controller]);
    return React.createElement('output', null, useRemoteCheckState(controller).status);
  }
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
  await act(async () => { root.render(React.createElement(React.StrictMode, null, React.createElement(Harness))); });
  assert.equal(outcomes.length, 2);
  assert.equal((await outcomes[0]).status, 'cancelled');
  assert.equal(signals[0].aborted, true);
  assert.equal(signals[1].aborted, false);
  await act(async () => { work.resolve(null); });
  assert.equal((await outcomes[1]).status, 'valid');
  assert.equal(content(), 'valid');
});

test('remote state updates stay in the subscribing field instead of rerendering its parent', async () => {
  let controller, parentRenders = 0;
  const work = deferred();
  const check = () => work.promise;
  function Field({ remote }) {
    return React.createElement('output', null, useRemoteCheckState(remote).status);
  }
  function Harness() {
    parentRenders++;
    controller = useRemoteCheckController(check);
    return React.createElement(Field, { remote: controller });
  }
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
  await act(async () => { root.render(React.createElement(Harness)); });
  const initialRenders = parentRenders;
  await act(async () => { controller.checkNow('usable'); });
  assert.equal(content(), 'checking');
  await act(async () => { work.resolve(null); });
  assert.equal(content(), 'valid');
  assert.equal(parentRenders, initialRenders);
});


test('shared slug validator rejects trailing line terminators as well as non-ASCII text', () => {
  for (const value of ['abc\n', 'abc\r', 'abc\r\n', 'abc\u2028', 'abc\u2029', 'café', 'ab', 'a'.repeat(33)]) {
    assert.notEqual(validateSlug(value), true, JSON.stringify(value));
  }
  for (const value of ['abc', 'a-b', 'a--b', 'a'.repeat(32)]) assert.equal(validateSlug(value), true);
});
