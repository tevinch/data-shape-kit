import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import test from 'node:test';

const demoPath = fileURLToPath(new URL('./demo.mjs', import.meta.url));
const demoDirectory = fileURLToPath(new URL('.', import.meta.url));

function runDemo(args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [demoPath, ...args], {
      cwd: demoDirectory,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

test('runs the bundled synthetic file and prints only two sample rows', async () => {
  const result = await runDemo();

  assert.equal(result.code, 0);
  assert.equal(result.stderr, '');
  assert.deepEqual(JSON.parse(result.stdout), {
    rows: 3,
    headers: ['id', 'name', 'note'],
    sample: [
      { id: '001', name: 'Lin', note: '中文🙂' },
      { id: '002', name: 'Ana', note: 'line one\nline two' },
    ],
  });
});

test('reads a supplied local CSV file and reports its rows', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'streaming-csv-demo-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const csvPath = join(directory, 'valid.csv');
  await writeFile(csvPath, 'key,value\nA,one\nB,two\nC,three\n');

  const result = await runDemo([csvPath]);

  assert.equal(result.code, 0);
  assert.equal(result.stderr, '');
  assert.deepEqual(JSON.parse(result.stdout), {
    rows: 3,
    headers: ['key', 'value'],
    sample: [
      { key: 'A', value: 'one' },
      { key: 'B', value: 'two' },
    ],
  });
});

test('prints an error and exits nonzero for malformed and missing files', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'streaming-csv-demo-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const malformedPath = join(directory, 'malformed.csv');
  await writeFile(malformedPath, 'id,note\n1,"open\n');

  const malformed = await runDemo([malformedPath]);
  assert.equal(malformed.code, 1);
  assert.equal(malformed.stdout, '');
  assert.match(malformed.stderr, /Error:.*quote/i);

  const missing = await runDemo([join(directory, 'missing.csv')]);
  assert.equal(missing.code, 1);
  assert.equal(missing.stdout, '');
  assert.match(missing.stderr, /Error:.*ENOENT/i);
});

test('rejects excess command-line arguments', async () => {
  const result = await runDemo(['one.csv', 'two.csv']);

  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /at most one CSV file path/i);
});
