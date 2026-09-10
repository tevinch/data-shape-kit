import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<div id="root"></div>', {
  url: 'http://localhost/',
});

Object.assign(globalThis, {
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  IS_REACT_ACT_ENVIRONMENT: true,
  window: dom.window,
});

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const {
  QueryClient,
  QueryClientProvider,
  useMutationState,
} = await import('@tanstack/react-query');

const client = new QueryClient({
  defaultOptions: { mutations: { gcTime: Infinity, retry: false } },
});
const cache = client.getMutationCache();
const pending = [];

for (const [key, variable] of [
  ['one', 1],
  ['two', 2],
]) {
  let resolve;
  const promise = new Promise((settle) => {
    resolve = settle;
  });
  const mutation = cache.build(client, {
    mutationKey: [key],
    mutationFn: () => promise,
  });
  pending.push({ execution: mutation.execute(variable), resolve });
}

await Promise.resolve();

const root = createRoot(document.getElementById('root'));
let events = 0;
const unsubscribe = cache.subscribe(() => {
  events += 1;
});

function View({ selectedKey }) {
  const variables = useMutationState({
    filters: selectedKey === null ? {} : { mutationKey: [selectedKey] },
    select: (mutation) => mutation.state.variables,
  });
  return React.createElement('output', null, JSON.stringify(variables));
}

async function render(selectedKey) {
  await React.act(async () => {
    root.render(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(View, { selectedKey }),
      ),
    );
  });
  return document.querySelector('output').textContent;
}

try {
  assert.equal(await render(null), '[1,2]');
  const before = events;
  const actual = await render('one');
  assert.equal(
    events,
    before,
    'changing only the filter must not create a mutation-cache event',
  );
  assert.equal(
    actual,
    '[1]',
    `unmodified 5.102.8 remains stale at ${actual}`,
  );
} finally {
  unsubscribe();
  await React.act(async () => {
    for (const operation of pending) {
      operation.resolve('done');
    }
    await Promise.all(pending.map((operation) => operation.execution));
    root.unmount();
  });
  client.clear();
  dom.window.close();
}
