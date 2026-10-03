import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';

const { attachIdleSave } = await import(process.env.IDLE_SAVE_MODULE || './idle-save.mjs');
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

// The editor's event/export boundary is modeled here; the guide records the
// separate browser check with the actual Quill editor and an HTTP receiver.
function editor() {
  const q = new EventEmitter();
  q.html = '<p>Existing document</p>';
  q.getSemanticHTML = () => q.html;
  q.edit = (html, source = 'user') => {
    q.html = html;
    q.emit('text-change', {}, {}, source);
  };
  return q;
}

test('the complete latest document is saved five seconds after the last user change', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const q = editor();
  const documents = [];
  const handle = attachIdleSave(q, { save: async html => { documents.push(html); } });
  q.edit('<p>first</p>');
  t.mock.timers.tick(4000);
  q.edit('<p>first and second</p>');
  t.mock.timers.tick(4999);
  await settle();
  assert.deepEqual(documents, []);
  t.mock.timers.tick(1);
  await settle();
  assert.deepEqual(documents, ['<p>first and second</p>']);
  handle.dispose();
});

test('initial API loading does not save, but clearing the document does', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const q = editor();
  const documents = [];
  const handle = attachIdleSave(q, { save: async html => { documents.push(html); } });
  q.edit('<p>Loaded</p>', 'api');
  t.mock.timers.tick(5000);
  await settle();
  assert.deepEqual(documents, []);
  q.edit('<p></p>');
  t.mock.timers.tick(5000);
  await settle();
  assert.deepEqual(documents, ['<p></p>']);
  handle.dispose();
});

test('a slow save cannot overwrite a later edit and requests stay sequential', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const q = editor();
  const first = Promise.withResolvers();
  const requests = [];
  let stored;
  const handle = attachIdleSave(q, { save: async html => {
    requests.push(html);
    if (requests.length === 1) await first.promise;
    stored = html;
  } });
  q.edit('<p>one</p>');
  t.mock.timers.tick(5000);
  await settle();
  q.edit('<p>two</p>');
  t.mock.timers.tick(5000);
  await settle();
  assert.deepEqual(requests, ['<p>one</p>']);
  first.resolve();
  await settle();
  assert.deepEqual(requests, ['<p>one</p>', '<p>two</p>']);
  assert.equal(stored, '<p>two</p>');
  assert.equal(q.html, '<p>two</p>');
  handle.dispose();
});

test('editing again while a save is slow resets the full idle period', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const q = editor();
  const first = Promise.withResolvers();
  const documents = [];
  const handle = attachIdleSave(q, { save: async html => {
    documents.push(html);
    if (documents.length === 1) await first.promise;
  } });
  q.edit('<p>one</p>');
  t.mock.timers.tick(5000);
  q.edit('<p>two</p>');
  t.mock.timers.tick(5000);
  q.edit('<p>three</p>');
  first.resolve();
  await settle();
  assert.deepEqual(documents, ['<p>one</p>']);
  t.mock.timers.tick(4999);
  await settle();
  assert.deepEqual(documents, ['<p>one</p>']);
  t.mock.timers.tick(1);
  await settle();
  assert.deepEqual(documents, ['<p>one</p>', '<p>three</p>']);
  handle.dispose();
});

test('a failed save retains the editor document and can be retried without another edit', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const q = editor();
  const states = [];
  let attempt = 0;
  let stored;
  const handle = attachIdleSave(q, {
    save: async html => {
      attempt++;
      if (attempt === 1) throw new Error('HTTP 503');
      stored = html;
    },
    onStatus: state => states.push(state),
  });
  q.edit('<p><strong>Keep this</strong></p>');
  t.mock.timers.tick(5000);
  await settle();
  assert.equal(attempt, 1);
  assert.equal(states.at(-1), 'error');
  assert.equal(q.html, '<p><strong>Keep this</strong></p>');
  handle.saveNow();
  await settle();
  assert.equal(attempt, 2);
  assert.equal(stored, '<p><strong>Keep this</strong></p>');
  assert.equal(states.at(-1), 'saved');
  handle.dispose();
});

test('disposing cancels scheduled work and prevents later edits or manual saves', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const q = editor();
  const documents = [];
  const handle = attachIdleSave(q, { save: async html => { documents.push(html); } });
  q.edit('<p>unsent</p>');
  handle.dispose();
  q.edit('<p>after disconnect</p>');
  handle.saveNow();
  t.mock.timers.tick(10000);
  await settle();
  assert.deepEqual(documents, []);
});
