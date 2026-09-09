import assert from 'node:assert/strict';
import { once } from 'node:events';
import { Readable } from 'node:stream';
import test from 'node:test';

import { consumeCsv } from './consume-csv.mjs';

function byteStream(input, sizes = [1]) {
  const bytes = Buffer.from(input);
  const chunks = [];
  let offset = 0;
  let sizeIndex = 0;

  while (offset < bytes.length) {
    const size = sizes[sizeIndex % sizes.length];
    chunks.push(bytes.subarray(offset, offset + size));
    offset += size;
    sizeIndex += 1;
  }

  return Readable.from(chunks, { objectMode: false });
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function afterImmediate() {
  return new Promise((resolve) => setImmediate(resolve));
}

test('decodes one-byte UTF-8 chunks and preserves CSV field text', async () => {
  const csv = '\uFEFFid,note,detail,empty,__proto__,constructor\r\n'
    + '001,"中文🙂","line one\r\nline two",,"a,b","said ""hello"""\r\n';
  const rows = [];

  const result = await consumeCsv(byteStream(csv), (row) => rows.push(row));

  assert.deepEqual(rows, [{
    id: '001',
    note: '中文🙂',
    detail: 'line one\r\nline two',
    empty: '',
    ['__proto__']: 'a,b',
    constructor: 'said "hello"',
  }]);
  assert.equal(Object.hasOwn(rows[0], '__proto__'), true);
  assert.deepEqual(result, {
    rows: 1,
    headers: ['id', 'note', 'detail', 'empty', '__proto__', 'constructor'],
  });
});

test('handles CR, LF, varied boundaries, custom delimiters, and blank lines', async () => {
  const rows = [];
  const source = byteStream(' left ;right;Right\rA;B;C\r\rD;"E;F";G\r', [2, 5, 1, 7]);

  const result = await consumeCsv(source, (row) => rows.push(row), { delimiter: ';' });

  assert.deepEqual(rows, [
    { ' left ': 'A', right: 'B', Right: 'C' },
    { ' left ': 'D', right: 'E;F', Right: 'G' },
  ]);
  assert.deepEqual(result, { rows: 2, headers: [' left ', 'right', 'Right'] });
});

test('treats every record after the first as data, including repeated empty fields', async () => {
  const rows = [];
  const csv = 'first,second\n'
    + '01,\n02,\n03,\n04,\n05,\n06,\n07,\n08,\n09,\n10,\n'
    + ',\n12,\n13,\n14,\n15,\n16,\nfirst,second\n18,\n19,\n20,\n';

  const result = await consumeCsv(byteStream(csv, [3, 11, 2]), (row) => rows.push(row));

  assert.deepEqual(rows, [
    { first: '01', second: '' },
    { first: '02', second: '' },
    { first: '03', second: '' },
    { first: '04', second: '' },
    { first: '05', second: '' },
    { first: '06', second: '' },
    { first: '07', second: '' },
    { first: '08', second: '' },
    { first: '09', second: '' },
    { first: '10', second: '' },
    { first: '', second: '' },
    { first: '12', second: '' },
    { first: '13', second: '' },
    { first: '14', second: '' },
    { first: '15', second: '' },
    { first: '16', second: '' },
    { first: 'first', second: 'second' },
    { first: '18', second: '' },
    { first: '19', second: '' },
    { first: '20', second: '' },
  ]);
  assert.deepEqual(result, { rows: 20, headers: ['first', 'second'] });
});

test('awaits callbacks sequentially and resolves after the final callback', async () => {
  const firstGate = deferred();
  const secondGate = deferred();
  const started = [];
  const completed = [];

  const consuming = consumeCsv(byteStream('id\n1\n2\n'), async (row, context) => {
    started.push([row.id, context.rowNumber, context.signal instanceof AbortSignal]);
    if (row.id === '1') await firstGate.promise;
    if (row.id === '2') await secondGate.promise;
    completed.push(row.id);
  });

  await afterImmediate();
  assert.deepEqual(started, [['1', 1, true]]);
  assert.deepEqual(completed, []);

  firstGate.resolve();
  await afterImmediate();
  assert.deepEqual(started, [['1', 1, true], ['2', 2, true]]);
  assert.deepEqual(completed, ['1']);

  secondGate.resolve();
  assert.deepEqual(await consuming, { rows: 2, headers: ['id'] });
  assert.deepEqual(completed, ['1', '2']);
});

test('propagates source backpressure while the first callback is blocked', async () => {
  const callbackStarted = deferred();
  const callbackGate = deferred();
  const chunkSize = 16 * 1024;
  const dataChunks = 256;
  const totalBytes = 6 + (dataChunks * chunkSize);
  const chunk = Buffer.from(`${'x'.repeat(chunkSize - 1)}\n`);
  let headerProduced = false;
  let chunksProduced = 0;
  let bytesProduced = 0;

  const source = new Readable({
    read() {
      if (!headerProduced) {
        headerProduced = true;
        bytesProduced += 6;
        this.push(Buffer.from('value\n'));
        return;
      }
      if (chunksProduced >= dataChunks) {
        this.push(null);
        return;
      }
      chunksProduced += 1;
      bytesProduced += chunk.length;
      this.push(chunk);
    },
  });

  const consuming = consumeCsv(source, async (_row, { rowNumber }) => {
    if (rowNumber === 1) {
      callbackStarted.resolve();
      await callbackGate.promise;
    }
  }, { maxRecordSize: chunkSize * 2 });

  await afterImmediate();
  await afterImmediate();
  assert.equal(bytesProduced > 0, true, 'the source was never consumed');
  await callbackStarted.promise;
  assert.ok(bytesProduced < totalBytes / 4, `produced ${bytesProduced} of ${totalBytes} bytes`);

  callbackGate.resolve();
  const result = await consuming;
  assert.equal(result.rows, dataChunks);
});

test('rejects malformed headers and missing headers with stable codes', async (t) => {
  const cases = [
    { name: 'duplicate', csv: 'id,id\n1,2\n', code: 'CSV_DUPLICATE_HEADER' },
    { name: 'empty', csv: 'id, \n1,2\n', code: 'CSV_EMPTY_HEADER' },
    { name: 'whitespace-only header', csv: '   \nvalue\n', code: 'CSV_EMPTY_HEADER' },
    { name: 'empty file', csv: '', code: 'CSV_MISSING_HEADER' },
    { name: 'LF-only blank file', csv: '\n\n', code: 'CSV_MISSING_HEADER' },
    { name: 'CRLF-only blank file', csv: '\r\n\r\n', code: 'CSV_MISSING_HEADER' },
    { name: 'CR-only blank file', csv: '\r\r', code: 'CSV_MISSING_HEADER' },
    { name: 'BOM-only file', csv: '\uFEFF', code: 'CSV_MISSING_HEADER' },
  ];

  for (const { name, csv, code } of cases) {
    await t.test(name, async () => {
      await assert.rejects(consumeCsv(byteStream(csv), () => {}), { code });
    });
  }
});

test('accepts a header-only file', async () => {
  const result = await consumeCsv(byteStream('id,name\n'), () => {});

  assert.deepEqual(result, { rows: 0, headers: ['id', 'name'] });
});

test('propagates syntax, width, record-size, and strict UTF-8 errors', async (t) => {
  const cases = [
    { name: 'unterminated quote', chunks: [Buffer.from('id\n"open')], options: {} },
    { name: 'short row', chunks: [Buffer.from('a,b\n1\n')], options: {} },
    { name: 'long row', chunks: [Buffer.from('a,b\n1,2,3\n')], options: {} },
    { name: 'record too large', chunks: [Buffer.from('id\n12345\n')], options: { maxRecordSize: 3 } },
    { name: 'invalid UTF-8', chunks: [Buffer.from([0x69, 0x64, 0x0a, 0xff, 0x0a])], options: {} },
    { name: 'incomplete UTF-8', chunks: [Buffer.from([0x69, 0x64, 0x0a, 0xf0, 0x9f])], options: {} },
  ];

  for (const { name, chunks, options } of cases) {
    await t.test(name, async () => {
      const source = Readable.from(chunks, { objectMode: false });
      await assert.rejects(consumeCsv(source, () => {}, options));
      assert.equal(source.destroyed, true);
    });
  }
});

test('tears down the source on source and callback errors without future callbacks', async (t) => {
  await t.test('source error', async () => {
    const sourceError = new Error('source failed');
    const source = new Readable({
      read() {
        this.destroy(sourceError);
      },
    });

    await assert.rejects(consumeCsv(source, () => {}), sourceError);
    assert.equal(source.destroyed, true);
  });

  await t.test('callback error', async () => {
    const callbackError = new Error('callback failed');
    const source = byteStream('id\n1\n2\n3\n');
    const seen = [];

    await assert.rejects(consumeCsv(source, (row) => {
      seen.push(row.id);
      throw callbackError;
    }), callbackError);
    await afterImmediate();

    assert.deepEqual(seen, ['1']);
    assert.equal(source.destroyed, true);
  });
});

test('supports cancellation before consumption and while a callback is pending', async (t) => {
  await t.test('already aborted', async () => {
    const controller = new AbortController();
    controller.abort(new Error('cancel before start'));
    const source = byteStream('id\n1\n');
    let calls = 0;

    await assert.rejects(consumeCsv(source, () => { calls += 1; }, { signal: controller.signal }), {
      name: 'AbortError',
    });
    assert.equal(calls, 0);
    assert.equal(source.destroyed, true);
  });

  await t.test('callback must settle before cancellation completes', async () => {
    const controller = new AbortController();
    const callbackStarted = deferred();
    const callbackGate = deferred();
    const source = byteStream('id\n1\n2\n3\n');
    const seen = [];
    let settled = false;

    const consuming = consumeCsv(source, async (row, context) => {
      seen.push([row.id, context.rowNumber, context.signal.aborted]);
      if (row.id === '1') {
        callbackStarted.resolve();
        await callbackGate.promise;
        settled = true;
      }
    }, { signal: controller.signal });

    await afterImmediate();
    assert.equal(seen.length, 1, 'the callback was never started');
    await callbackStarted.promise;
    controller.abort(new Error('cancel pending callback'));
    await afterImmediate();
    assert.equal(settled, false);

    callbackGate.resolve();
    await assert.rejects(consuming, { name: 'AbortError' });
    await afterImmediate();
    assert.equal(settled, true);
    assert.deepEqual(seen, [['1', 1, false]]);
    assert.equal(source.destroyed, true);
  });
});

test('validates every argument before pulling from the source', async (t) => {
  const invalidCases = [
    { name: 'missing source', source: null, callback: () => {}, options: {} },
    { name: 'object-mode source', source: Readable.from([{ id: 1 }]), callback: () => {}, options: {} },
    { name: 'encoded source', source: Readable.from([Buffer.from('id\n')]), callback: () => {}, options: {}, prepare(source) { source.setEncoding('utf8'); } },
    { name: 'non-function callback', source: byteStream('id\n'), callback: null, options: {} },
    { name: 'null options', source: byteStream('id\n'), callback: () => {}, options: null },
    { name: 'array options', source: byteStream('id\n'), callback: () => {}, options: [] },
    { name: 'unknown option', source: byteStream('id\n'), callback: () => {}, options: { columns: true } },
    { name: 'empty delimiter', source: byteStream('id\n'), callback: () => {}, options: { delimiter: '' } },
    { name: 'newline delimiter', source: byteStream('id\n'), callback: () => {}, options: { delimiter: '\n' } },
    { name: 'quote delimiter', source: byteStream('id\n'), callback: () => {}, options: { delimiter: '"' } },
    { name: 'zero record size', source: byteStream('id\n'), callback: () => {}, options: { maxRecordSize: 0 } },
    { name: 'unsafe record size', source: byteStream('id\n'), callback: () => {}, options: { maxRecordSize: Number.MAX_SAFE_INTEGER + 1 } },
    { name: 'non-native signal', source: byteStream('id\n'), callback: () => {}, options: { signal: { aborted: false } } },
  ];

  for (const entry of invalidCases) {
    await t.test(entry.name, async () => {
      let reads = 0;
      const originalRead = entry.source?._read;
      if (entry.source) {
        entry.prepare?.(entry.source);
        entry.source._read = function (...args) {
          reads += 1;
          return originalRead.apply(this, args);
        };
      }

      await assert.rejects(consumeCsv(entry.source, entry.callback, entry.options), TypeError);
      assert.equal(reads, 0);
    });
  }
});

test('rejects a stream that is not fresh before taking ownership', async () => {
  const source = byteStream('id\n1\n');
  source.read(1);

  await assert.rejects(consumeCsv(source, () => {}), TypeError);
});
