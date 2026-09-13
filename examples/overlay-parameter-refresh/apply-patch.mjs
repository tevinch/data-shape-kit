import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.argv[2] || 'node_modules/ag-grid-react');
const packageInfo = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
if (packageInfo.name !== 'ag-grid-react' || packageInfo.version !== '36.1.0') {
  throw new Error('This patch supports exactly ag-grid-react 36.1.0. No files changed.');
}
const files = [
  ['dist/package/index.esm.mjs', '2011067f83c65c3e087d60a973b509c0629d5bf6fd1a2894269f5bc9bb2427df'],
  ['dist/package/index.cjs.js', '81e41d87f18080eb33f0f846491ff43bed22e7af0860e0118f582e323b146251'],
];
const before = '          case "activeOverlay":\n            return CustomOverlayComponentWrapper;';
const after = '          case "activeOverlay":\n          case "overlayComponent":\n            return CustomOverlayComponentWrapper;';
const hash = text => createHash('sha256').update(text).digest('hex');
const plans = [];
// Validate both complete files before writing either one. Refuse unrelated edits.
for (const [relative, expected] of files) {
  const path = resolve(root, relative);
  const current = await readFile(path, 'utf8');
  if (current.split(after).length === 2 && hash(current.replace(after, before)) === expected) {
    plans.push({ path, current, patched: current });
  } else if (hash(current) === expected && current.split(before).length === 2) {
    plans.push({ path, current, patched: current.replace(before, after) });
  } else throw new Error(`Unrecognized bytes in ${relative}. No files changed; use a clean 36.1.0 install.`);
}
const changed = [];
try {
  for (const plan of plans) {
    if (plan.current !== plan.patched) {
      changed.push(plan);
      await writeFile(plan.path, plan.patched);
    }
  }
} catch (error) {
  const rollback = await Promise.allSettled(changed.map(plan => writeFile(plan.path, plan.current)));
  if (rollback.some(result => result.status === 'rejected')) {
    throw new Error('Patch write failed and rollback was incomplete. Reinstall dependencies before building.', { cause: error });
  }
  throw error;
}
console.log(changed.length ? 'Patched the React overlay wrapper in ESM and CommonJS.' : 'The exact overlay wrapper patch is already applied.');
