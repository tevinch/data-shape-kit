import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, link, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyPatch } from './apply-patch.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const temporary = await mkdtemp(path.join(tmpdir(), 'storybook-config-'));
const root = path.join(temporary, 'application');
const installed = path.join(here, 'node_modules/storybook');
const packageRoot = path.join(root, 'node_modules/storybook');
const manifest = JSON.parse(await readFile(path.join(here, 'hashes.json'), 'utf8'));
const relative = Object.keys(manifest.files)[0];
const target = path.join(packageRoot, relative);
const metadataPath = path.join(packageRoot, 'package.json');

try {
  await mkdir(path.dirname(target), { recursive: true });
  await cp(path.join(installed, relative), target);
  await cp(path.join(installed, 'package.json'), metadataPath);
  if (await applyPatch(root, { checkOnly: true }) === 'already patched') {
    const reverse = spawnSync('git', ['-c', 'core.autocrlf=false', 'apply', '-R', path.join(here, 'patches/storybook-10.6.0.patch')], {
      cwd: root, encoding: 'utf8', env: { ...process.env, GIT_CEILING_DIRECTORIES: temporary },
    });
    assert.equal(reverse.status, 0, reverse.stderr);
  }
  const original = await readFile(target);
  assert.equal(await applyPatch(root, { checkOnly: true }), 'original bytes verified; patch applies');
  assert.deepEqual(await readFile(target), original);
  const metadata = await readFile(metadataPath, 'utf8');
  await writeFile(metadataPath, JSON.stringify({ ...JSON.parse(metadata), version: '10.6.1' }));
  await assert.rejects(applyPatch(root), /Expected storybook@10.6.0/);
  assert.deepEqual(await readFile(target), original);
  await writeFile(metadataPath, metadata);
  const modified = Buffer.concat([original, Buffer.from('\n// local edit\n')]);
  await writeFile(target, modified);
  await assert.rejects(applyPatch(root), /Runtime bytes differ/);
  assert.deepEqual(await readFile(target), modified);
  await writeFile(target, original);
  const linked = path.join(temporary, 'linked-runtime.js');
  await link(target, linked);
  await assert.rejects(applyPatch(root), /Linked or irregular/);
  await rm(linked);
  const external = path.join(temporary, 'external-runtime.js');
  await writeFile(external, original);
  await rm(target);
  await symlink(external, target);
  await assert.rejects(applyPatch(root), /Linked or irregular/);
  assert.deepEqual(await readFile(external), original);
  await rm(target);
  await writeFile(target, original);
  assert.equal(await applyPatch(root), 'runtime patched and verified');
  const patched = await readFile(target);
  assert.equal(await applyPatch(root), 'already patched');
  assert.deepEqual(await readFile(target), patched);
  console.log('Installer: version, original bytes, local edits, links, dry run and repeated application passed');
  for (const mode of ['typescript', 'broken', 'unexpected-error', 'unexpected-value']) {
    const result = spawnSync(process.execPath, [path.join(here, 'node-contract.mjs'), mode], { cwd: here, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    process.stdout.write(result.stdout);
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
