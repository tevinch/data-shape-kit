import test, { before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const bundle = new URL(`./.form-test-${process.pid}.mjs`, import.meta.url);
const globals = ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'Element', 'Event', 'Node', 'SVGElement', 'ShadowRoot', 'getComputedStyle'];
let dom, React, act, createRoot, Form, Input, CodeForm, useCodeRule, CODE_PATTERN;
let root, container, form, rule;
const NativeMessageChannel = globalThis.MessageChannel;
const channels = new Set();
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
before(async () => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
  for (const name of globals) globalThis[name] = dom.window[name];
  window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  // Form's notification batching creates native channels. Preserve delivery and
  // close their Node ports when this DOM fixture ends, like closing the window.
  globalThis.MessageChannel = class extends NativeMessageChannel {
    constructor() { super(); channels.add(this); }
  };
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = await import('react');
  ({ act } = React);
  ({ createRoot } = await import('react-dom/client'));
  ({ Form, Input } = await import('antd'));
  await build({ entryPoints: [fileURLToPath(new URL('./code-form-example.tsx', import.meta.url))], outfile: fileURLToPath(bundle), bundle: true, packages: 'external', platform: 'node', format: 'esm', jsx: 'automatic' });
  ({ CodeForm, useCodeRule, CODE_PATTERN } = await import(bundle.href));
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = undefined;
  container?.remove();
  form = rule = undefined;
});
after(async () => {
  dom?.window.close();
  for (const channel of channels) { channel.port1.close(); channel.port2.close(); }
  channels.clear();
  globalThis.MessageChannel = NativeMessageChannel;
  await unlink(fileURLToPath(bundle)).catch(() => {});
  // This file runs in its own test process. Keep the closed window available
  // while Ant Design's native error-display timers finish after unmount.
});
function Harness({ checkCode, delayMs = 60000, timeoutMs = 10000 }) {
  [form] = Form.useForm();
  rule = useCodeRule(form, checkCode, { delayMs, timeoutMs });
  return React.createElement(Form, { form }, React.createElement(Form.Item, {
    name: 'code', label: 'Entity code', validateFirst: 'parallel',
    rules: [{ required: true, whitespace: true, message: 'Code is required' }, { pattern: CODE_PATTERN, message: 'Code format is invalid' }, { validator: rule.validator }],
  }, React.createElement(Input)));
}
async function render(props, harness = false, strict = false) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  const child = React.createElement(harness ? Harness : CodeForm, { delayMs: 60000, ...props });
  await act(async () => root.render(strict ? React.createElement(React.StrictMode, null, child) : child));
}
async function input(value) {
  const element = container.querySelector('input');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function submit() {
  await act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}
async function click(label) {
  const button = [...container.querySelectorAll('button')].find(item => item.textContent === label);
  assert.ok(button, label);
  await act(async () => button.click());
}
async function settle(ms = 20) {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, ms)); });
}
const text = () => container.textContent;
async function expectRendered(pattern) {
  const deadline = Date.now() + 1000;
  while (!pattern.test(text()) && Date.now() < deadline) await settle(10);
  assert.match(text(), pattern);
}

test('required and format rules fail immediately while remote work remains debounced', async () => {
  const calls = [];
  await render({ checkCode: value => { calls.push(value); return null; } }, true);
  await input('valid');
  assert.equal(form.isFieldValidating('code'), true);
  await input('');
  assert.deepEqual(form.getFieldError('code'), ['Code is required']);
  assert.equal(form.isFieldValidating('code'), false);
  await input('Bad Code');
  assert.deepEqual(form.getFieldError('code'), ['Code format is invalid']);
  assert.deepEqual(calls, []);
});

test('rapid edits start only the latest remote request after its delay', async () => {
  const calls = [], pending = deferred();
  await render({ delayMs: 30, checkCode: value => { calls.push(value); return pending.promise; } }, true);
  await input('first');
  await input('second');
  assert.deepEqual(calls, []);
  await settle(50);
  assert.deepEqual(calls, ['second']);
  assert.equal(form.isFieldValidating('code'), true);
  await act(async () => pending.resolve(null));
  assert.equal(form.isFieldValidating('code'), false);
  assert.deepEqual(form.getFieldError('code'), []);
});

test('a late ignored-abort result cannot replace the latest Form state', async () => {
  const old = deferred(), latest = deferred(), signals = [];
  await render({ delayMs: 0, checkCode: (value, { signal }) => { signals.push(signal); return value === 'first' ? old.promise : latest.promise; } }, true);
  await input('first'); await settle();
  await input('second'); await settle();
  assert.equal(signals[0].aborted, true);
  await act(async () => old.resolve('Old error'));
  assert.deepEqual(form.getFieldError('code'), []);
  assert.equal(form.isFieldValidating('code'), true);
  await act(async () => latest.resolve('Current error'));
  assert.deepEqual(form.getFieldError('code'), ['Current error']);
});

test('clearing a running field aborts it and retains the required error', async () => {
  const pending = deferred(); let signal;
  await render({ delayMs: 0, checkCode: (_value, context) => { signal = context.signal; return pending.promise; } }, true);
  await input('valid'); await settle();
  await input('');
  assert.equal(signal.aborted, true);
  assert.deepEqual(form.getFieldError('code'), ['Code is required']);
  await act(async () => pending.resolve('Obsolete message'));
  assert.deepEqual(form.getFieldError('code'), ['Code is required']);
});

test('native submit flushes the pending delay and accepts only after successful validation', async () => {
  const pending = deferred(), calls = [], accepted = [];
  await render({ checkCode: value => { calls.push(value); return pending.promise; }, onValid: values => { accepted.push(values); } }, false, true);
  await input('first'); await input('latest');
  assert.deepEqual(calls, []);
  await submit();
  assert.deepEqual(calls, ['latest']);
  assert.deepEqual(accepted, []);
  await act(async () => pending.resolve(null));
  assert.deepEqual(accepted, [{ code: 'latest' }]);
});

test('submitted empty or invalid format values never call the checker or onValid', async () => {
  const calls = [], accepted = [];
  await render({ checkCode: value => { calls.push(value); return null; }, onValid: value => accepted.push(value) });
  await submit(); await expectRendered(/Code is required/);
  await input('Bad Code'); await submit(); await expectRendered(/Use 3/);
  assert.deepEqual(calls, []); assert.deepEqual(accepted, []);
});

for (const kind of ['invalid', 'throw', 'timeout']) {
  test(`${kind} remote outcome blocks submit and shows an appropriate error`, async () => {
    const accepted = [];
    await render({ timeoutMs: 25, checkCode: () => {
      if (kind === 'invalid') return 'Code already exists';
      if (kind === 'throw') throw new Error('Private service detail');
      return new Promise(() => {});
    }, onValid: value => accepted.push(value) });
    await input('valid'); await submit();
    await expectRendered(kind === 'invalid' ? /Code already exists/ : /Unable to validate/);
    assert.deepEqual(accepted, []);
    assert.doesNotMatch(text(), /Private service detail/);
  });
}

test('wrapped validateFields bypasses debounce for programmatic checks', async () => {
  const pending = deferred(), calls = []; let validation;
  await render({ checkCode: value => { calls.push(value); return pending.promise; } }, true);
  await act(async () => form.setFieldValue('code', 'sample'));
  await act(async () => { validation = rule.runImmediately(() => form.validateFields()); });
  assert.deepEqual(calls, ['sample']);
  await act(async () => pending.resolve(null));
  assert.deepEqual(await validation, { code: 'sample' });
});

test('direct programmatic replacement cannot turn old success into approval of the new value', async () => {
  const pending = deferred(); let observed;
  await render({ checkCode: () => pending.promise }, true);
  await input('first');
  await act(async () => { observed = rule.runImmediately(() => form.validateFields()).then(value => ({ value }), error => ({ error })); });
  await act(async () => form.setFieldValue('code', 'second'));
  await act(async () => pending.resolve(null));
  const outcome = await observed;
  assert.ok(outcome.error);
  assert.equal(outcome.value, undefined);
  assert.equal(form.getFieldValue('code'), 'second');
});

test('reset and sample replacement cancel pending validation without accepting stale values', async () => {
  const pending = deferred(), accepted = []; let signal;
  await render({ checkCode: (_value, context) => { signal = context.signal; return pending.promise; }, onValid: value => accepted.push(value) });
  await input('first'); await submit(); await click('Reset');
  assert.equal(signal.aborted, true);
  assert.equal(container.querySelector('input').value, '');
  await act(async () => pending.resolve(null));
  assert.deepEqual(accepted, []);
  await input('third'); await click('Use sample code');
  assert.equal(container.querySelector('input').value, 'sample-code');
  assert.deepEqual(accepted, []);
});

test('unmount aborts validation and prevents a late submission callback', async () => {
  const pending = deferred(), accepted = []; let signal;
  await render({ checkCode: (_value, context) => { signal = context.signal; return pending.promise; }, onValid: value => accepted.push(value) });
  await input('first'); await submit();
  await act(async () => root.unmount()); root = undefined;
  assert.equal(signal.aborted, true);
  await act(async () => pending.resolve(null));
  assert.deepEqual(accepted, []);
});
