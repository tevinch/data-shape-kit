import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await readFile(path.join(here, 'hashes.json'), 'utf8'));
const patchFile = path.join(here, 'patches/storybook-10.6.0.patch');
const digest = data => createHash('sha256').update(data).digest('hex');

async function installationState(appRoot) {
  const root = await realpath(appRoot);
  let parent = root;
  for (const part of ['node_modules', 'storybook']) {
    parent = path.join(parent, part);
    const info = await lstat(parent);
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new Error('Use a regular npm or Yarn node-modules installation; linked package paths are unsupported.');
    }
  }
  const packageRoot = parent;
  const packageInfo = await lstat(path.join(packageRoot, 'package.json'));
  if (!packageInfo.isFile() || packageInfo.isSymbolicLink() || packageInfo.nlink !== 1) {
    throw new Error('Package metadata must be a regular, unlinked file.');
  }
  const metadata = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
  if (metadata.name !== manifest.package || metadata.version !== manifest.version) {
    throw new Error(`Expected ${manifest.package}@${manifest.version}.`);
  }
  const states = [];
  for (const [relative, hashes] of Object.entries(manifest.files)) {
    const file = path.join(packageRoot, relative);
    let component = packageRoot;
    for (const part of relative.split('/').slice(0, -1)) {
      component = path.join(component, part);
      const info = await lstat(component);
      if (info.isSymbolicLink() || !info.isDirectory()) throw new Error(`Linked directory: ${relative}`);
    }
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) throw new Error(`Linked or irregular file: ${relative}`);
    const hash = digest(await readFile(file));
    states.push(hash === hashes.original ? 'original' : hash === hashes.patched ? 'patched' : 'unknown');
  }
  if (states.every(state => state === 'patched')) return { root, state: 'patched' };
  if (!states.every(state => state === 'original')) throw new Error('Runtime bytes differ or the patch is only partly applied.');
  return { root, state: 'original' };
}

function applyGit(root, check) {
  const args = ['-c', 'core.autocrlf=false', 'apply'];
  if (check) args.push('--check');
  args.push(patchFile);
  const result = spawnSync('git', args, {
    cwd: root,
    env: { ...process.env, GIT_CEILING_DIRECTORIES: path.dirname(root) },
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`git apply failed: ${result.stderr || result.stdout}`);
}

export async function applyPatch(appRoot = process.cwd(), { checkOnly = false } = {}) {
  const before = await installationState(appRoot);
  if (before.state === 'patched') return 'already patched';
  applyGit(before.root, true);
  if (checkOnly) return 'original bytes verified; patch applies';
  applyGit(before.root, false);
  const after = await installationState(before.root);
  if (after.state !== 'patched') throw new Error('Post-apply verification failed; restore with npm ci before using the package.');
  return 'runtime patched and verified';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const checkOnly = args.includes('--check');
    const roots = args.filter(arg => arg !== '--check');
    if (roots.length > 1 || roots.some(arg => arg.startsWith('--'))) throw new Error('Usage: node apply-patch.mjs [application-directory] [--check]');
    console.log(await applyPatch(roots[0] || process.cwd(), { checkOnly }));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
