import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const originalHash = 'e13ed4a14639865f2a4caa81db6b1c0ad150dafe58d02262628c29866efc5509';
const patchedHash = '231d5e7b312c226c961e4fab8734250fa5f49d50a0ae9963fe087bac01533d81';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

export async function patchSvelte(directory) {
  const root = await fs.realpath(directory);
  const metadata = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  if (metadata.name !== 'svelte' || metadata.version !== '5.57.1') {
    throw new Error('This patch requires the published svelte@5.57.1 package.');
  }
  const file = path.join(root, 'src/internal/client/reactivity/batch.js');
  const original = await fs.readFile(file);
  if (hash(original) === patchedHash) return 'Already patched';
  if (hash(original) !== originalHash) throw new Error('batch.js differs from the published 5.57.1 source; no files changed.');
  const result = Buffer.from(original.toString('utf8').replace(
    '\t/** @type {Batch} */ (current_batch).schedule(effect);',
    '\tBatch.ensure().schedule(effect);'
  ));
  if (hash(result) !== patchedHash) throw new Error('Unexpected patch result; no files changed.');
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, result, { flag: 'wx', mode: (await fs.stat(file)).mode & 0o777 });
    // Replace the file instead of modifying a potentially shared package-store inode.
    await fs.rename(temporary, file);
  } finally {
    await fs.rm(temporary, { force: true });
  }
  return 'Patched svelte@5.57.1';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(await patchSvelte(process.argv[2] || 'node_modules/svelte')); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
