import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<body></body>', { url: 'http://localhost/' });
Object.assign(globalThis, {
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  IS_REACT_ACT_ENVIRONMENT: true,
  window: dom.window,
});

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { QueryClient, QueryClientProvider } = await import(
  '@tanstack/react-query'
);
const { MutationList } = await import('../.test-dist/MutationList.js');
const { toMutationRow } = await import('../.test-dist/mutation-rows.js');
const { useMutationRows } = await import('../.test-dist/useMutationRows.js');

function createHarness() {
  const client = new QueryClient({
    defaultOptions: { mutations: { gcTime: Infinity, retry: false } },
  });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const clients = new Set([client]);
  const operations = [];

  function start(key, variable, targetClient = client) {
    clients.add(targetClient);
    let resolve;
    const promise = new Promise((settle) => {
      resolve = settle;
    });
    const mutation = targetClient.getMutationCache().build(targetClient, {
      mutationKey: key,
      mutationFn: () => promise,
    });
    const operation = {
      execution: mutation.execute(variable),
      mutation,
      resolve,
    };
    operations.push(operation);
    return operation;
  }

  async function renderElement(element, strict = false, providerClient = client) {
    clients.add(providerClient);
    const view = React.createElement(
      QueryClientProvider,
      { client: providerClient },
      element,
    );
    await React.act(async () => {
      root.render(strict ? React.createElement(React.StrictMode, null, view) : view);
    });
  }

  async function render(props, strict = false, providerClient = client) {
    await renderElement(
      React.createElement(MutationList, props),
      strict,
      providerClient,
    );
  }

  async function flush() {
    await React.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  async function cleanup() {
    for (const operation of operations) {
      operation.resolve('done');
    }
    await Promise.all(operations.map((operation) => operation.execution));
    await flush();
    await React.act(async () => root.unmount());
    for (const knownClient of clients) {
      knownClient.clear();
    }
    container.remove();
  }

  return {
    cleanup,
    client,
    container,
    flush,
    render,
    renderElement,
    start,
  };
}

function displayedVariables(container) {
  return [...container.querySelectorAll('li')].map((item) => item.textContent);
}

function displayedCount(container) {
  return container.querySelector('output').textContent;
}

test('filters all pending rows on each render without a cache event', async () => {
  const harness = createHarness();
  const one = harness.start(['one'], 1);
  const two = harness.start(['two'], 2);
  const cache = harness.client.getMutationCache();
  let events = 0;
  const unsubscribe = cache.subscribe(() => {
    events += 1;
  });

  try {
    await harness.render({ selectedKey: null }, true);
    assert.equal(displayedCount(harness.container), '2');
    assert.deepEqual(displayedVariables(harness.container), ['1', '2']);

    const before = events;
    await harness.render({ selectedKey: 'one' }, true);
    assert.equal(events, before);
    assert.equal(displayedCount(harness.container), '1');
    assert.deepEqual(displayedVariables(harness.container), ['1']);

    await harness.render({ selectedKey: 'two' }, true);
    assert.equal(events, before);
    assert.deepEqual(displayedVariables(harness.container), ['2']);

    await harness.render({ selectedKey: 'missing' }, true);
    assert.equal(events, before);
    assert.equal(displayedCount(harness.container), '0');
    assert.match(harness.container.textContent, /No pending operations\./);

    await harness.render({ selectedKey: null }, true);
    assert.equal(events, before);
    assert.deepEqual(displayedVariables(harness.container), ['1', '2']);
  } finally {
    unsubscribe();
    one.resolve('done');
    two.resolve('done');
    await harness.cleanup();
  }
});

test('applies a changed formatter immediately without a cache event', async () => {
  const harness = createHarness();
  harness.start(['one'], '<strong>unsafe</strong>');
  const cache = harness.client.getMutationCache();
  let events = 0;
  const unsubscribe = cache.subscribe(() => {
    events += 1;
  });

  try {
    await harness.render({
      formatVariable: (value) => `first:${String(value)}`,
      selectedKey: null,
    });
    const before = events;
    assert.deepEqual(displayedVariables(harness.container), [
      'first:<strong>unsafe</strong>',
    ]);
    assert.equal(harness.container.querySelector('strong'), null);

    await harness.render({
      formatVariable: (value) => `second:${String(value)}`,
      selectedKey: null,
    });
    assert.equal(events, before);
    assert.deepEqual(displayedVariables(harness.container), [
      'second:<strong>unsafe</strong>',
    ]);
  } finally {
    unsubscribe();
    await harness.cleanup();
  }
});

test('tracks real pending, success, addition, removal, and clear transitions', async () => {
  const harness = createHarness();
  const one = harness.start(['one'], 1);
  const two = harness.start(['two'], 2);

  try {
    await harness.render({ selectedKey: null }, true);
    assert.deepEqual(displayedVariables(harness.container), ['1', '2']);

    await React.act(async () => {
      one.resolve('done');
      await one.execution;
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    assert.equal(displayedCount(harness.container), '1');
    assert.deepEqual(displayedVariables(harness.container), ['2']);

    const three = harness.start(['three'], 3);
    await harness.flush();
    assert.equal(displayedCount(harness.container), '2');
    assert.deepEqual(displayedVariables(harness.container), ['2', '3']);

    harness.client.getMutationCache().remove(two.mutation);
    await harness.flush();
    assert.deepEqual(displayedVariables(harness.container), ['3']);

    harness.client.clear();
    await harness.flush();
    assert.equal(displayedCount(harness.container), '0');
    assert.match(harness.container.textContent, /No pending operations\./);

    three.resolve('done');
  } finally {
    await harness.cleanup();
  }
});

test('keeps same-key rows distinct and preserves empty keys and falsy variables', async () => {
  const harness = createHarness();
  const first = harness.start(['same'], 'first');
  const second = harness.start(['same'], 'second');
  harness.start([''], 0);
  harness.start([''], false);
  harness.start([''], null);

  try {
    assert.notEqual(toMutationRow(first.mutation).id, toMutationRow(second.mutation).id);
    await harness.render({ selectedKey: 'same' });
    assert.equal(displayedCount(harness.container), '2');
    assert.deepEqual(displayedVariables(harness.container), ['first', 'second']);

    await harness.render({ selectedKey: '' });
    assert.equal(displayedCount(harness.container), '3');
    assert.deepEqual(displayedVariables(harness.container), ['0', 'false', 'null']);
  } finally {
    await harness.cleanup();
  }
});

test('captures the immutable state reference from each real mutation update', async () => {
  const harness = createHarness();
  const operation = harness.start(['typed'], { id: 7 });
  const pendingRow = toMutationRow(operation.mutation);

  try {
    assert.equal(pendingRow.state.status, 'pending');
    await React.act(async () => {
      operation.resolve({ accepted: true });
      await operation.execution;
    });
    const successRow = toMutationRow(operation.mutation);
    assert.equal(pendingRow.state.status, 'pending');
    assert.equal(successRow.state.status, 'success');
    assert.notEqual(successRow.state, pendingRow.state);
  } finally {
    await harness.cleanup();
  }
});

test('reuses the row array across unchanged snapshots and unrelated renders', async () => {
  const harness = createHarness();
  harness.start(['one'], 1);
  const snapshots = [];
  const snapshotErrors = [];
  const originalConsoleError = console.error;

  function SnapshotProbe({ label }) {
    const rows = useMutationRows();
    snapshots.push(rows);
    return React.createElement('span', null, label);
  }

  console.error = (...args) => {
    snapshotErrors.push(args.map(String).join(' '));
    originalConsoleError(...args);
  };

  try {
    await harness.renderElement(
      React.createElement(SnapshotProbe, { label: 'first' }),
      true,
    );
    const firstSnapshot = snapshots.at(-1);

    await harness.renderElement(
      React.createElement(SnapshotProbe, { label: 'second' }),
      true,
    );
    const secondSnapshot = snapshots.at(-1);

    assert.equal(firstSnapshot, secondSnapshot);
    assert.deepEqual(
      snapshotErrors.filter((message) =>
        message.includes('The result of getSnapshot should be cached'),
      ),
      [],
    );
  } finally {
    console.error = originalConsoleError;
    await harness.cleanup();
  }
});

test('switches provider caches and ignores later notifications from the old cache', async () => {
  const harness = createHarness();
  const replacementClient = new QueryClient({
    defaultOptions: { mutations: { gcTime: Infinity, retry: false } },
  });
  harness.start(['old'], 'old', harness.client);
  harness.start(['new'], 'new', replacementClient);

  try {
    await harness.render({ selectedKey: null }, true, harness.client);
    assert.deepEqual(displayedVariables(harness.container), ['old']);

    await harness.render({ selectedKey: null }, true, replacementClient);
    assert.deepEqual(displayedVariables(harness.container), ['new']);

    harness.start(['old-late'], 'old-late', harness.client);
    await harness.flush();
    assert.deepEqual(displayedVariables(harness.container), ['new']);
  } finally {
    await harness.cleanup();
  }
});

test.after(() => {
  dom.window.close();
});
