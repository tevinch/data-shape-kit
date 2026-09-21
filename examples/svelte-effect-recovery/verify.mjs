import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { patchSvelte } from './patch.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const work = path.join(root, '.verification');
const installed = path.join(root, 'node_modules/svelte');
const relativeSource = 'src/internal/client/reactivity/batch.js';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const source = await fs.readFile(path.join(installed, relativeSource));
assert.equal(hash(source), 'e13ed4a14639865f2a4caa81db6b1c0ad150dafe58d02262628c29866efc5509', 'Run npm ci first: the baseline requires the original svelte@5.57.1 source.');
await fs.rm(work, { recursive: true, force: true });
await fs.mkdir(work, { recursive: true });

function run(script, args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  assert.equal(result.signal, null, `${script} was interrupted`);
  assert.equal(result.status, expectedStatus, `${script} returned an unexpected status`);
}

for (const label of ['original', 'patched']) {
  const directory = path.join(work, label);
  await fs.cp(installed, directory, { recursive: true, dereference: true });
  if (label === 'patched') {
    assert.equal(await patchSvelte(directory), 'Patched svelte@5.57.1');
    const first = await fs.readFile(path.join(directory, relativeSource));
    assert.equal(await patchSvelte(directory), 'Already patched');
    assert.deepEqual(await fs.readFile(path.join(directory, relativeSource)), first);
  }
  run('build.mjs', [directory, label]);
  run('check.mjs', [label], label === 'original' ? 1 : 0);
  const results = JSON.parse(await fs.readFile(path.join(work, `${label}-results.json`), 'utf8'));
  assert.equal(results.length, 4);
  for (const row of results) {
    if (label === 'original') {
      assert.equal(row.passed, false);
      assert.ok(row.errors.some(error => error.includes("Cannot read properties of null (reading 'schedule')")), 'The baseline must fail for the original bug, not a missing dependency or omitted operation.');
      assert.equal(row.checks.flushes, 6);
      assert.equal(row.checks.asyncMode, row.mode.startsWith('async'));
    } else {
      assert.equal(row.passed, true);
    }
  }
}

const invalid = path.join(work, 'invalid');
await fs.cp(installed, invalid, { recursive: true, dereference: true });
const metadataFile = path.join(invalid, 'package.json');
const metadata = JSON.parse(await fs.readFile(metadataFile, 'utf8'));
await fs.writeFile(metadataFile, JSON.stringify({ ...metadata, version: '5.57.0' }));
await assert.rejects(() => patchSvelte(invalid), /requires the published/);
assert.deepEqual(await fs.readFile(path.join(invalid, relativeSource)), source);
await fs.writeFile(metadataFile, JSON.stringify(metadata));
const modified = Buffer.concat([source, Buffer.from('\n// Local change\n')]);
await fs.writeFile(path.join(invalid, relativeSource), modified);
await assert.rejects(() => patchSvelte(invalid), /differs from the published/);
assert.deepEqual(await fs.readFile(path.join(invalid, relativeSource)), modified);
assert.deepEqual(await fs.readFile(path.join(installed, relativeSource)), source);
console.log('Verified the original failure, recovery, repeated interaction, patch refusal and unchanged installed source.');
