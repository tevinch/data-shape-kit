import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const exampleDirectory = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(exampleDirectory, 'preview-run.sh');
const producerPath = join(exampleDirectory, 'fixtures', 'producer.mjs');
const nodePath = process.execPath;
const temporaryRoots = [];

after(() => {
  for (const root of temporaryRoots) {
    rmSync(root, { recursive: true, force: true });
  }
});

function makeTemporaryRoot() {
  const root = mkdtempSync(join(tmpdir(), 'preview-run-test-'));
  temporaryRoots.push(root);
  return root;
}

function runPreview(arguments_, { temporaryRoot = makeTemporaryRoot() } = {}) {
  const result = spawnSync('sh', [scriptPath, ...arguments_], {
    cwd: temporaryRoot,
    encoding: 'utf8',
    env: { ...process.env, TMPDIR: temporaryRoot },
    timeout: 5_000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  return result;
}

function outputLogPath(stderr) {
  const match = /^Full output: (.+)$/m.exec(stderr);
  assert.ok(match, `missing output log diagnostic in: ${stderr}`);
  return match[1];
}

function assertCompleteCapture(result, markerPath) {
  const previewLines = result.stdout.trimEnd().split('\n');
  assert.equal(previewLines.length, 120);
  assert.equal(previewLines[0], 'line-001');
  assert.equal(previewLines[119], 'line-120');
  assert.doesNotMatch(result.stdout, /line-121|late stderr/);
  assert.ok(existsSync(markerPath), 'producer must finish after all writes');

  const logPath = outputLogPath(result.stderr);
  assert.equal(statSync(logPath).mode & 0o777, 0o600);
  const log = readFileSync(logPath, 'utf8');
  assert.match(log, /^line-001\n/);
  assert.match(log, /line-125\nlate stderr after preview boundary\n$/);
}

test('capture completes before the 120-line preview can close', () => {
  const root = makeTemporaryRoot();
  const markerPath = join(root, 'completed.json');

  const result = runPreview([nodePath, producerPath, markerPath, '0'], {
    temporaryRoot: root,
  });

  assert.equal(result.status, 0);
  assertCompleteCapture(result, markerPath);
});

test('a failing producer keeps its exit code after capture and preview', () => {
  const root = makeTemporaryRoot();
  const markerPath = join(root, 'failed-but-complete.json');

  const result = runPreview([nodePath, producerPath, markerPath, '7'], {
    temporaryRoot: root,
  });

  assert.equal(result.status, 7);
  assertCompleteCapture(result, markerPath);
});

test('literal empty, spaced and shell metacharacter arguments are preserved', () => {
  const root = makeTemporaryRoot();
  const markerPath = join(root, 'arguments.json');
  const unwantedSideEffect = join(root, 'must-not-exist');
  const literalArguments = [
    '',
    'two words',
    'semi;colon',
    `$(touch ${unwantedSideEffect})`,
    '*',
  ];

  const result = runPreview(
    [nodePath, producerPath, markerPath, '0', ...literalArguments],
    { temporaryRoot: root },
  );

  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(readFileSync(markerPath, 'utf8')), literalArguments);
  assert.equal(existsSync(unwantedSideEffect), false);
});

test('the restrictive log umask does not change files created by the command', () => {
  const root = makeTemporaryRoot();
  const markerPath = join(root, 'caller-mode.json');
  const result = spawnSync(
    'sh',
    [
      '-c',
      'umask 022; exec sh "$@"',
      'umask-test',
      scriptPath,
      nodePath,
      producerPath,
      markerPath,
      '0',
    ],
    {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, TMPDIR: root },
      timeout: 5_000,
    },
  );

  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0);
  assert.equal(statSync(markerPath).mode & 0o777, 0o644);
});

test('no command reports usage and exits 64 without creating a log', () => {
  const result = runPreview([]);

  assert.equal(result.status, 64);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Usage: sh preview-run\.sh command \[argument \.\.\.\]/);
  assert.doesNotMatch(result.stderr, /^Full output:/m);
});

test('log creation failure exits 125 before running the command', () => {
  const root = makeTemporaryRoot();
  const markerPath = join(root, 'must-not-run.json');
  const missingTemporaryDirectory = join(root, 'missing', 'directory');
  const result = spawnSync(
    'sh',
    [scriptPath, nodePath, producerPath, markerPath, '0'],
    {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, TMPDIR: missingTemporaryDirectory },
      timeout: 5_000,
    },
  );

  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 125);
  assert.equal(existsSync(markerPath), false);
  assert.match(result.stderr, /Could not create output log; command was not run\./);
  assert.doesNotMatch(result.stderr, /^Full output:/m);
});

test('a command that is not found returns 127 and leaves its diagnostic in the log', () => {
  const result = runPreview(['command-output-fixture-that-does-not-exist']);

  assert.equal(result.status, 127);
  const log = readFileSync(outputLogPath(result.stderr), 'utf8');
  assert.match(log, /command-output-fixture-that-does-not-exist/);
  assert.equal(result.stdout, log);
});

test('preview failure reports the problem without replacing the command exit code', () => {
  const root = makeTemporaryRoot();
  const markerPath = join(root, 'preview-failed-after-completion.json');
  const result = spawnSync(
    'sh',
    [
      '-c',
      'exec 1>&-; exec sh "$@"',
      'preview-failure-test',
      scriptPath,
      nodePath,
      producerPath,
      markerPath,
      '7',
    ],
    {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, TMPDIR: root },
      stdio: ['ignore', 'ignore', 'pipe'],
      timeout: 5_000,
    },
  );

  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 7);
  assert.ok(existsSync(markerPath));
  assert.match(result.stderr, /Could not display preview; full output remains in the log\./);
  const log = readFileSync(outputLogPath(result.stderr), 'utf8');
  assert.match(log, /late stderr after preview boundary/);
});

test('direct head closes before the bounded producer records completion', () => {
  const root = makeTemporaryRoot();
  const markerPath = join(root, 'direct-pipe-completed.json');
  const result = spawnSync(
    'sh',
    [
      '-c',
      '"$1" "$2" "$3" 0 | head -n 120 >/dev/null',
      'direct-head-test',
      nodePath,
      producerPath,
      markerPath,
    ],
    {
      cwd: root,
      encoding: 'utf8',
      timeout: 5_000,
    },
  );

  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(existsSync(markerPath), false);
});
