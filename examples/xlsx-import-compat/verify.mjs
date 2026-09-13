import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, 'original-hashes.json'), 'utf8'));
const patchFile = path.join(root, 'patches', 'exceljs+4.4.0.patch');
const testFile = 'import.test.cjs';
const cliArguments = process.argv.slice(2);

if (
  cliArguments.length > 1
  || (cliArguments.length === 1 && cliArguments[0] !== '--original')
) {
  throw new Error(`Unknown argument: ${cliArguments.join(' ')}`);
}

async function sha256(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

async function packageVersion(installationRoot, packageName) {
  const packageFile = path.join(
    installationRoot,
    'node_modules',
    packageName,
    'package.json',
  );
  return JSON.parse(await readFile(packageFile, 'utf8')).version;
}

async function validatePackage(installationRoot, packageName, expected) {
  const actualVersion = await packageVersion(installationRoot, packageName);
  if (actualVersion !== expected.version) {
    throw new Error(
      `Version gate failed: expected ${packageName} ${expected.version}, found ${actualVersion}`,
    );
  }

  const hashes = {};
  for (const [relativeFile, expectedHash] of Object.entries(expected.files)) {
    const manifestPath = `${packageName}/${relativeFile}`;
    const file = path.join(installationRoot, 'node_modules', manifestPath);
    const actualHash = await sha256(file);
    hashes[manifestPath] = actualHash;
    if (actualHash !== expectedHash) {
      throw new Error(
        `Source hash gate failed for ${manifestPath}: expected ${expectedHash}, found ${actualHash}`,
      );
    }
  }
  return hashes;
}

async function validateInstallation(installationRoot) {
  const hashes = {};
  for (const [packageName, expected] of Object.entries(manifest)) {
    Object.assign(hashes, await validatePackage(installationRoot, packageName, expected));
  }
  return hashes;
}

function run(command, args, cwd, {allowFailure = false} = {}) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      GIT_CEILING_DIRECTORIES: cwd,
      NODE_PATH: '',
      NO_COLOR: '1',
    };
    delete env.FORCE_COLOR;
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    for (const stream of [child.stdout, child.stderr]) {
      stream.on('data', chunk => {
        const text = chunk.toString();
        output += text;
        process.stdout.write(text);
      });
    }
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${command} ${args.join(' ')} ended with signal ${signal}`));
      } else if (code !== 0 && !allowFailure) {
        reject(new Error(`${command} ${args.join(' ')} exited ${code}`));
      } else {
        resolve({code, output});
      }
    });
  });
}

async function copyExceljsForGate(sourceRoot, destinationRoot) {
  const packageRoot = path.join(destinationRoot, 'node_modules', 'exceljs');
  await mkdir(packageRoot, {recursive: true});
  await cp(
    path.join(sourceRoot, 'node_modules', 'exceljs', 'package.json'),
    path.join(packageRoot, 'package.json'),
  );
  for (const relativeFile of Object.keys(manifest.exceljs.files)) {
    const destination = path.join(packageRoot, relativeFile);
    await mkdir(path.dirname(destination), {recursive: true});
    await cp(path.join(sourceRoot, 'node_modules', 'exceljs', relativeFile), destination);
  }
}

async function expectGateFailure(label, operation, expectedMessage) {
  let failure;
  try {
    await operation();
  } catch (error) {
    failure = error;
  }
  assert(failure instanceof Error, `${label} must fail before patch application`);
  assert.equal(failure.message, expectedMessage);
  console.log(`PASS [gate] ${label}: ${expectedMessage}`);
}

async function verifyRejectionGates(verificationRoot) {
  const wrongVersionRoot = path.join(verificationRoot, 'wrong-version');
  await copyExceljsForGate(root, wrongVersionRoot);
  const packageFile = path.join(wrongVersionRoot, 'node_modules', 'exceljs', 'package.json');
  const packageModel = JSON.parse(await readFile(packageFile, 'utf8'));
  packageModel.version = '0.0.0-gate-test';
  await writeFile(packageFile, `${JSON.stringify(packageModel, null, 2)}\n`);
  await expectGateFailure(
    'wrong ExcelJS version',
    () => validateInstallation(wrongVersionRoot),
    'Version gate failed: expected exceljs 4.4.0, found 0.0.0-gate-test',
  );

  const changedSourceRoot = path.join(verificationRoot, 'changed-source');
  await copyExceljsForGate(root, changedSourceRoot);
  const relativeFile = 'lib/xlsx/xform/strings/shared-string-xform.js';
  const sourceFile = path.join(changedSourceRoot, 'node_modules', 'exceljs', relativeFile);
  await writeFile(sourceFile, `${await readFile(sourceFile, 'utf8')}\n`);
  const changedHash = await sha256(sourceFile);
  await expectGateFailure(
    'changed ExcelJS source',
    () => validateInstallation(changedSourceRoot),
    `Source hash gate failed for exceljs/${relativeFile}: expected ${manifest.exceljs.files[relativeFile]}, found ${changedHash}`,
  );
}

async function assertIsolatedResolution(isolatedRoot) {
  const isolatedRealRoot = await realpath(isolatedRoot);
  const requireFromIsolated = createRequire(path.join(isolatedRoot, 'resolve.cjs'));
  for (const packageName of ['exceljs', 'jszip']) {
    const resolved = await realpath(requireFromIsolated.resolve(`${packageName}/package.json`));
    assert(
      resolved.startsWith(
        `${path.join(isolatedRealRoot, 'node_modules', packageName)}${path.sep}`,
      ),
      `${packageName} resolved outside the temporary installation: ${resolved}`,
    );
  }
  console.log('PASS [isolation] exceljs and jszip resolve inside the temporary copy');
}

async function prepareIsolatedTest(verificationRoot) {
  const isolatedRoot = path.join(verificationRoot, 'isolated');
  await mkdir(isolatedRoot, {recursive: true});
  await cp(path.join(root, 'node_modules'), path.join(isolatedRoot, 'node_modules'), {
    recursive: true,
    dereference: true,
  });
  await cp(path.join(root, testFile), path.join(isolatedRoot, testFile));
  await assertIsolatedResolution(isolatedRoot);
  await validateInstallation(isolatedRoot);
  return isolatedRoot;
}

async function runTests(installationRoot, {allowFailure = false} = {}) {
  return run(
    process.execPath,
    ['--test', '--test-reporter=tap', testFile],
    installationRoot,
    {allowFailure},
  );
}

function requireOutput(output, pattern, label) {
  if (!pattern.test(output)) {
    throw new Error(`Original run did not prove ${label}`);
  }
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function validateKnownReproduction({code, output}) {
  assert.notEqual(code, 0, 'Original ExcelJS unexpectedly passed every regression test');
  requireOutput(output, /1\.\.15/, 'the complete 15-test run');
  requireOutput(output, /# tests 15/, 'the expected scenario count');
  requireOutput(output, /# pass 5/, 'the five stock passing scenarios');
  requireOutput(output, /# fail 10/, 'the ten known stock failures');

  const expectedPasses = [
    'REGRESSION [inline-mixed] inline string keeps leading "" and rich-text formatting through XLSX load/write',
    'CONTROL a genuine collision after truncation still rejects',
    'CONTROL ordinary rich text and neighbouring scalar/formula cells remain intact',
    'CONTROL worksheet names still reject case-insensitive duplicates',
    'CONTROL an ordinary hyperlink keeps its text and relationship target',
  ];
  const expectedFailures = [
    'REGRESSION [shared-mixed] shared string keeps leading "" and rich-text formatting through XLSX load/write',
    'REGRESSION [shared-mixed] shared string keeps leading " leading 空白 & " and rich-text formatting through XLSX load/write',
    'REGRESSION [shared-mixed] shared string keeps leading "0" and rich-text formatting through XLSX load/write',
    'REGRESSION [inline-mixed] inline string keeps leading " leading 空白 & " and rich-text formatting through XLSX load/write',
    'REGRESSION [inline-mixed] inline string keeps leading "0" and rich-text formatting through XLSX load/write',
    'REGRESSION [combined] the combined long-name and mixed-string workbook imports',
    'REGRESSION [long-name] a long worksheet name imports without colliding with itself',
    'REGRESSION [shared-hyperlink] shared hyperlink preserves its target and nested mixed rich text',
    'REGRESSION [inline-hyperlink] inline hyperlink preserves its target and nested mixed rich text',
    'REGRESSION [stress] 12 sheets and 671 distinct mixed strings survive load/write',
  ];
  for (const name of expectedPasses) {
    requireOutput(
      output,
      new RegExp(`(?:^|\\n)ok \\d+ - ${escapeRegExp(name)}(?:\\n|$)`),
      `expected stock pass: ${name}`,
    );
  }
  for (const name of expectedFailures) {
    requireOutput(
      output,
      new RegExp(`(?:^|\\n)not ok \\d+ - ${escapeRegExp(name)}(?:\\n|$)`),
      `expected stock failure: ${name}`,
    );
  }

  requireOutput(
    output,
    /Cannot create property 'richText' on string[\s\S]*SharedStringXform\.parseClose/,
    'the shared-string parser failure',
  );
  requireOutput(
    output,
    /Cannot create property 'richText' on string[\s\S]*CellXform\.parseClose/,
    'the inline-string parser failure',
  );
  requireOutput(
    output,
    /Worksheet name already exists: Existing Partner Full menu Expa/,
    'the current-worksheet long-name collision',
  );
}

async function runPatchedVerification() {
  const beforeHashes = await validateInstallation(root);
  const verificationRoot = await mkdtemp(path.join(os.tmpdir(), 'xlsx-import-compat-'));
  let failure;
  try {
    console.log(`Node ${process.version}`);
    console.log(
      `Versions: exceljs@${await packageVersion(root, 'exceljs')}, jszip@${await packageVersion(root, 'jszip')}`,
    );
    await verifyRejectionGates(verificationRoot);
    const isolatedRoot = await prepareIsolatedTest(verificationRoot);
    console.log('RUN [patch-check] exceljs+4.4.0.patch');
    await run('git', ['apply', '--check', patchFile], isolatedRoot);
    console.log('RUN [patch] exceljs+4.4.0.patch');
    await run('git', ['apply', patchFile], isolatedRoot);
    console.log('RUN [tests] patched temporary installation');
    await runTests(isolatedRoot);
  } catch (error) {
    failure = error;
  } finally {
    await rm(verificationRoot, {recursive: true, force: true});
    console.log(`CLEAN [temporary] ${path.basename(verificationRoot)}`);
  }

  try {
    const afterHashes = await validateInstallation(root);
    assert.deepEqual(
      afterHashes,
      beforeHashes,
      'Original installed ExcelJS source hashes changed during verification',
    );
    console.log('PASS [isolation] original installed ExcelJS source hashes unchanged');
  } catch (error) {
    failure = failure
      ? new AggregateError([failure, error], 'Verification and isolation failed')
      : error;
  }

  if (failure) throw failure;
  console.log('PASS 15 XLSX import compatibility scenarios');
}

async function runOriginalReproduction() {
  const beforeHashes = await validateInstallation(root);
  console.log(`Node ${process.version}`);
  console.log(
    `Versions: exceljs@${await packageVersion(root, 'exceljs')}, jszip@${await packageVersion(root, 'jszip')}`,
  );
  console.log('RUN [tests] original unmodified installation');
  const result = await runTests(root, {allowFailure: true});
  const afterHashes = await validateInstallation(root);
  assert.deepEqual(
    afterHashes,
    beforeHashes,
    'Original installed ExcelJS source hashes changed during reproduction',
  );
  console.log('PASS [isolation] original installed ExcelJS source hashes unchanged');
  validateKnownReproduction(result);
  console.error(
    `KNOWN REPRODUCTION: stock ExcelJS reached all scenarios and reproduced all three target failure paths; test exit code ${result.code}`,
  );
  process.exitCode = result.code;
}

if (cliArguments[0] === '--original') {
  await runOriginalReproduction();
} else {
  await runPatchedVerification();
}
