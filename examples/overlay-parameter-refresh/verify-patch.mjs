import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const temp = await mkdtemp(join(tmpdir(), 'overlay-patch-'));
const before = '          case "activeOverlay":\n            return CustomOverlayComponentWrapper;';
const after = '          case "activeOverlay":\n          case "overlayComponent":\n            return CustomOverlayComponentWrapper;';
const paths = ['dist/package/index.esm.mjs', 'dist/package/index.cjs.js'];
const originals = await Promise.all(paths.map(async path => (await readFile(join(root, 'node_modules/ag-grid-react', path), 'utf8')).replace(after, before)));
const run = () => spawnSync(process.execPath, [join(root, 'apply-patch.mjs'), temp], { encoding: 'utf8' });
const contents = () => Promise.all(paths.map(path => readFile(join(temp, path), 'utf8')));
async function reset(version = '36.1.0') {
  await mkdir(join(temp, 'dist/package'), { recursive: true });
  await writeFile(join(temp, 'package.json'), JSON.stringify({ name: 'ag-grid-react', version }));
  await Promise.all(paths.map((path, index) => writeFile(join(temp, path), originals[index])));
}
try {
  await reset(); assert.equal(run().status, 0);
  const patched = await contents(); assert.notDeepEqual(patched, originals);
  assert.equal(run().status, 0); assert.deepEqual(await contents(), patched, 'second run must not change files');
  await reset('36.1.1'); assert.notEqual(run().status, 0);
  assert.deepEqual(await contents(), originals, 'wrong version must not change either file');
  await reset(); await writeFile(join(temp, paths[1]), originals[1] + '\n// unrelated edit\n');
  const edited = await contents(); assert.notEqual(run().status, 0);
  assert.deepEqual(await contents(), edited, 'a changed second file must prevent the first file being patched');
  await reset(); await rm(join(temp, paths[1])); assert.notEqual(run().status, 0);
  assert.equal(await readFile(join(temp, paths[0]), 'utf8'), originals[0], 'a missing second file must prevent the first file being patched');
  console.log('Patch checks passed: clean install, repeat application, wrong version, changed file, missing file.');
} finally { await rm(temp, { recursive: true, force: true }); }
