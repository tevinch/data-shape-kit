import assert from 'node:assert/strict';
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import test from 'node:test';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import {createDemoServer} from './server.mjs';

async function withServer(run, options) {
  const server = createDemoServer(options);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

async function readJson(response) {
  assert.match(response.headers.get('content-type') ?? '', /^application\/json\b/);
  return response.json();
}

test('GET /api/page returns bounded pages and fixed-scope totals', async () => {
  await withServer(async (baseUrl) => {
    const first = await fetch(`${baseUrl}/api/page`);
    assert.equal(first.status, 200);
    assert.deepEqual(await readJson(first), {
      rows: [
        {id: 'item-001', title: 'Resource 01', category: 'Utilities', selectable: true},
        {id: 'item-002', title: 'Resource 02', category: 'Guides', selectable: true},
        {id: 'item-003', title: 'Resource 03', category: 'Utilities', selectable: true},
        {id: 'item-004', title: 'Resource 04', category: 'Guides', selectable: true},
        {id: 'item-005', title: 'Resource 05', category: 'Utilities', selectable: true},
      ],
      rowCount: 23,
      eligibleCount: 20,
      scope: 'catalog-v1:all',
      pageIndex: 0,
      pageSize: 5,
    });

    const last = await fetch(`${baseUrl}/api/page?pageIndex=4&sort=asc&category=all`);
    assert.equal(last.status, 200);
    const lastBody = await readJson(last);
    assert.equal(lastBody.rows.length, 3);
    assert.deepEqual(lastBody.rows.map((row) => row.id), ['item-021', 'item-022', 'item-023']);
    assert.equal(Object.hasOwn(lastBody, 'ids'), false);
    assert.ok(lastBody.rows.length <= 5);
  });
});

test('GET /api/page filters and sorts without changing page size', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/page?category=Guides&sort=desc&pageIndex=0`);
    assert.equal(response.status, 200);
    const body = await readJson(response);
    assert.deepEqual(body.rows.map((row) => row.id), [
      'item-022', 'item-020', 'item-018', 'item-016', 'item-014',
    ]);
    assert.equal(body.rowCount, 11);
    assert.equal(body.eligibleCount, 10);
    assert.equal(body.scope, 'catalog-v1:Guides');
    assert.equal(body.pageSize, 5);

    const empty = await fetch(`${baseUrl}/api/page?category=Empty&pageIndex=0&sort=asc`);
    assert.equal(empty.status, 200);
    assert.deepEqual(await readJson(empty), {
      rows: [],
      rowCount: 0,
      eligibleCount: 0,
      scope: 'catalog-v1:Empty',
      pageIndex: 0,
      pageSize: 5,
    });
  });
});

test('POST /api/preview resolves an exclude descriptor on the server', async () => {
  await withServer(async (baseUrl) => {
    const selection = {scope: 'catalog-v1:all', mode: 'exclude', ids: ['item-002']};
    const response = await fetch(`${baseUrl}/api/preview`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify(selection),
    });

    assert.equal(response.status, 200);
    const body = await readJson(response);
    assert.equal(body.scope, 'catalog-v1:all');
    assert.equal(body.count, 19);
    assert.equal(body.rows.length, 5);
    assert.equal(body.rows.some((row) => row.id === 'item-002'), false);
    assert.deepEqual(body.rows.map((row) => row.id), [
      'item-001', 'item-003', 'item-004', 'item-005', 'item-006',
    ]);
  });
});

test('POST /api/preview validates scope and every stored ID', async () => {
  await withServer(async (baseUrl) => {
    const invalidSelections = [
      {scope: 'catalog-v2:all', mode: 'include', ids: []},
      {scope: 'catalog-v1:all', mode: 'include', ids: ['unknown']},
      {scope: 'catalog-v1:all', mode: 'include', ids: ['item-007']},
      {scope: 'catalog-v1:Guides', mode: 'include', ids: ['item-001']},
    ];

    for (const selection of invalidSelections) {
      const response = await fetch(`${baseUrl}/api/preview`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify(selection),
      });
      assert.equal(response.status, 400);
      const body = await readJson(response);
      assert.equal(typeof body.error, 'string');
      assert.ok(body.error.length > 0);
      assert.equal(body.error.includes('/Users/'), false);
    }
  });
});

test('malformed requests return JSON errors and unknown routes return 404', async () => {
  await withServer(async (baseUrl) => {
    for (const path of [
      '/api/page?category=Nope',
      '/api/page?pageIndex=-1',
      '/api/page?pageIndex=1.5',
      '/api/page?pageIndex=9007199254740992',
      '/api/page?sort=sideways',
    ]) {
      const response = await fetch(`${baseUrl}${path}`);
      assert.equal(response.status, 400);
      assert.equal(typeof (await readJson(response)).error, 'string');
    }

    const malformed = await fetch(`${baseUrl}/api/preview`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: '{',
    });
    assert.equal(malformed.status, 400);
    assert.equal(typeof (await readJson(malformed)).error, 'string');

    const missing = await fetch(`${baseUrl}/missing.txt`);
    assert.equal(missing.status, 404);
    assert.equal(typeof (await readJson(missing)).error, 'string');
  });
});

test('POST /api/preview rejects request bodies over 64 KiB', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/preview`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({
        scope: 'catalog-v1:all',
        mode: 'include',
        ids: ['x'.repeat(65 * 1024)],
      }),
    });
    assert.equal(response.status, 413);
    assert.equal(typeof (await readJson(response)).error, 'string');
  });
});

test('serves files only from the configured built output directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cross-page-selection-'));
  const distDirectory = join(root, 'dist');
  await mkdir(distDirectory);
  await writeFile(join(distDirectory, 'index.html'), '<h1>Built demo</h1>');
  await writeFile(join(root, 'private.txt'), 'outside');

  try {
    await withServer(async (baseUrl) => {
      const home = await fetch(`${baseUrl}/`);
      assert.equal(home.status, 200);
      assert.match(home.headers.get('content-type') ?? '', /^text\/html\b/);
      assert.equal(await home.text(), '<h1>Built demo</h1>');

      const outside = await fetch(`${baseUrl}/..%2Fprivate.txt`);
      assert.equal(outside.status, 404);
      assert.equal(typeof (await readJson(outside)).error, 'string');
    }, {distDirectory});
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
