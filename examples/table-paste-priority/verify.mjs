import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyPatch } from './apply-patch.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const temporary = await mkdtemp(path.join(tmpdir(), 'table-paste-'));
const packageRelative = 'node_modules/@limetech/lime-elements';
const installed = path.join(here, packageRelative);
const manifest = JSON.parse(await readFile(path.join(here, 'hashes.json'), 'utf8'));
const fixture = path.join(temporary, 'application');
const packageRoot = path.join(fixture, packageRelative);

async function bytes() {
    return Promise.all(Object.keys(manifest.files).map(name => readFile(path.join(packageRoot, name))));
}
function browser(loader, label, expectSuccess) {
    const report = path.join(here, 'test-results', label + '.json');
    const result = spawnSync(process.execPath, [path.join(here, 'browser.test.mjs'), packageRoot, loader, report], {
        cwd: here, encoding: 'utf8', env: process.env,
    });
    if (result.error) throw result.error;
    if (expectSuccess && result.status !== 0) throw Error(result.stdout + result.stderr);
    if (!expectSuccess) assert.equal(result.status, 1, 'original runtime must fail the regressions');
    return readFile(report, 'utf8').then(JSON.parse);
}
try {
    await cp(installed, packageRoot, { recursive: true });
    assert.equal(await applyPatch(fixture, { checkOnly: true }), 'original bytes verified; patch applies', 'npm ci must supply an original installation');
    const original = await bytes();
    assert.equal(await applyPatch(fixture, { checkOnly: true }), 'original bytes verified; patch applies');
    assert.deepEqual(await bytes(), original, 'check-only must not write runtime files');
    const baseline = await browser('bundle', 'original-bundle', false);
    for (const name of ['table with link URL in plain text', 'table containing image']) {
        const test = baseline.find(test => test.name === name);
        assert.equal(test?.pass, false, 'original defect must be reproduced: ' + name);
        assert.ok(test?.actual, 'failure must capture initialized document state');
        assert.deepEqual(test.errors, [], 'baseline must not fail because the page crashed');
    }
    const first = path.join(packageRoot, Object.keys(manifest.files)[0]);
    await writeFile(first, Buffer.concat([original[0], Buffer.from('\n// local change\n')]));
    const modified = await bytes();
    await assert.rejects(applyPatch(fixture), /Runtime bytes differ/);
    assert.deepEqual(await bytes(), modified, 'rejecting a local modification must leave every file alone');
    await writeFile(first, original[0]);
    const metadataPath = path.join(packageRoot, 'package.json');
    const metadata = await readFile(metadataPath, 'utf8');
    await writeFile(metadataPath, JSON.stringify({ ...JSON.parse(metadata), version: '40.2.3' }));
    await assert.rejects(applyPatch(fixture), /Expected/);
    assert.deepEqual(await bytes(), original, 'wrong-version rejection must not change runtime files');
    await writeFile(metadataPath, metadata);
    assert.equal(await applyPatch(fixture), 'all six runtime files patched and verified');
    const patched = await bytes();
    assert.equal(await applyPatch(fixture), 'already patched');
    assert.deepEqual(await bytes(), patched, 'reapplying the patch must be a no-op');
    await writeFile(first, original[0]);
    const partial = await bytes();
    await assert.rejects(applyPatch(fixture), /only partly applied/);
    assert.deepEqual(await bytes(), partial, 'partial-state rejection must not write');
    await writeFile(first, patched[0]);
    for (const loader of ['bundle', 'esm']) {
        const tests = await browser(loader, 'patched-' + loader, true);
        assert.equal(tests.length, 18);
        assert.ok(tests.every(test => test.pass));
        console.log(loader + ': ' + tests.length + ' browser cases passed');
    }
    console.log('Version, byte-integrity, dry-run, idempotency and partial-state checks passed.');
} finally {
    await rm(temporary, { recursive: true, force: true });
}
