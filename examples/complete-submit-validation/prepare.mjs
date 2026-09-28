import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
export const original = dirname(require.resolve('@tanstack/form-core/package.json'));
const hashes = {
  "src/FormApi.ts": "34495d6b0825b759ee06c873b81a43a7e5a0c5479bb31584b1188ce4f5fd9ba3",
  "dist/esm/FormApi.js": "ab119f3fccb517b8bba0e713b4abcda3cd5fcbe37bc8b088af48ff700cbadf89",
  "dist/cjs/FormApi.cjs": "5418f437092239cd0f8e439ac66b65cad130303911139ab7d6449fe277580b76",
  "dist/esm/FormApi.d.ts": "740e74a57e46bdb28d196a569f6b01b340333c15279fae935cc7d8dbfc9c9243",
  "dist/cjs/FormApi.d.cts": "bce63c47dc9a8c8050c17ad58f910fae36b2f8f34be1979ca97c718d3b0c59b3"
};

export async function checkOriginal() {
  const manifest = JSON.parse(await readFile(join(original, 'package.json'), 'utf8'));
  if (manifest.version !== '1.33.5') throw Error('Expected the official form-core 1.33.5 package');
  for (const [file, expected] of Object.entries(hashes)) {
    const actual = createHash('sha256').update(await readFile(join(original, file))).digest('hex');
    if (actual !== expected) throw Error(`Original package differs at ${file}; use a clean npm ci first`);
  }
}

export async function prepare(mode) {
  await checkOriginal();
  const temporary = await mkdtemp(join(root, '.verification-'));
  try {
    let packageRoot = original;
    if (mode === 'patched') {
      packageRoot = join(temporary, 'node_modules/@tanstack/form-core');
      await cp(original, packageRoot, { recursive: true });
      const options = { cwd: packageRoot, env: { ...process.env, GIT_CEILING_DIRECTORIES: root }, stdio: 'pipe' };
      const patch = join(root, 'patches/form-core-1.33.5.patch');
      execFileSync('git', ['apply', '--check', patch], options);
      execFileSync('git', ['apply', patch], options);
    }
    return { temporary, packageRoot };
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
}
