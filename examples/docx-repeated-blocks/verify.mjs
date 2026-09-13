import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdtemp, mkdir, readFile, realpath, rm, writeFile, appendFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const fixtureRoot = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await readFile(path.join(fixtureRoot, "original-hashes.json"), "utf8"));
const expected = manifest.docx;
const patchFile = path.join(fixtureRoot, "patches", "docx+9.7.1.patch");

class ChildProcessError extends Error {
  constructor(command, args, code, signal, stdout, stderr) {
    const outcome = signal ? `signal ${signal}` : `exit ${code}`;
    super(`${command} ${args.join(" ")} failed with ${outcome}`);
    this.name = "ChildProcessError";
    this.command = command;
    this.args = args;
    this.code = code;
    this.signal = signal;
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

async function sha256(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

async function validateInstallation(installationRoot) {
  const packageRoot = path.join(installationRoot, "node_modules", "docx");
  const packageData = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
  if (packageData.version !== expected.version) {
    throw new Error(`Version gate failed: expected docx ${expected.version}, found ${packageData.version}`);
  }

  const hashes = {};
  for (const [relativeFile, expectedHash] of Object.entries(expected.files)) {
    const target = path.join(packageRoot, relativeFile);
    const actualHash = await sha256(target);
    hashes[relativeFile] = actualHash;
    if (actualHash !== expectedHash) {
      throw new Error(`Source hash gate failed for docx/${relativeFile}: expected ${expectedHash}, found ${actualHash}`);
    }
  }
  return hashes;
}

function run(command, args, cwd, { quiet = false } = {}) {
  if (!quiet) console.log(`RUN ${command} ${args.join(" ")}`);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, NODE_PATH: "", GIT_CEILING_DIRECTORIES: installationCeiling(cwd) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => {
      const output = chunk.toString();
      stdout += output;
      if (!quiet) process.stdout.write(output);
    });
    child.stderr.on("data", chunk => {
      const output = chunk.toString();
      stderr += output;
      if (!quiet) process.stderr.write(output);
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code !== 0 || signal) reject(new ChildProcessError(command, args, code, signal, stdout, stderr));
      else resolve({ code, stdout, stderr });
    });
  });
}

function installationCeiling(cwd) {
  return path.dirname(path.resolve(cwd));
}

async function resolveEntrypoints(installationRoot) {
  const localRequire = createRequire(pathToFileURL(path.join(installationRoot, "package.json")));
  const requireTarget = await realpath(localRequire.resolve("docx"));
  const esmResult = await run(
    process.execPath,
    ["--input-type=module", "--eval", "process.stdout.write(import.meta.resolve('docx'))"],
    installationRoot,
    { quiet: true },
  );
  const importTarget = await realpath(fileURLToPath(esmResult.stdout));
  const modulesRoot = await realpath(path.join(installationRoot, "node_modules"));
  for (const [mode, target] of [["require", requireTarget], ["import", importTarget]]) {
    assert(target.startsWith(`${modulesRoot}${path.sep}`), `${mode} resolved outside temporary node_modules: ${target}`);
  }
  assert.equal(requireTarget, await realpath(path.join(installationRoot, "node_modules", "docx", "dist", "index.cjs")));
  assert.equal(importTarget, await realpath(path.join(installationRoot, "node_modules", "docx", "dist", "index.mjs")));
  return { requireTarget, importTarget };
}

async function copyDocx(sourceRoot, destinationRoot) {
  await mkdir(path.join(destinationRoot, "node_modules"), { recursive: true });
  await cp(
    path.join(sourceRoot, "node_modules", "docx"),
    path.join(destinationRoot, "node_modules", "docx"),
    { recursive: true, dereference: true },
  );
}

async function applyVerifiedPatch(installationRoot) {
  await validateInstallation(installationRoot);
  await run("git", ["apply", "--check", patchFile], installationRoot);
  await run("git", ["apply", patchFile], installationRoot);
}

async function expectFailure(label, operation, check) {
  let caught;
  try {
    await operation();
  } catch (error) {
    caught = error;
  }
  assert(caught, `${label} unexpectedly succeeded`);
  assert(check(caught), `${label} returned an unexpected error: ${caught?.stack ?? caught}`);
  console.log(`PASS [gate] ${label}`);
  return caught;
}

async function finalize(primaryError, cleanup, integrityCheck) {
  const failures = primaryError ? [primaryError] : [];
  try {
    await cleanup();
  } catch (error) {
    failures.push(error);
  }
  try {
    await integrityCheck();
  } catch (error) {
    failures.push(error);
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, "Verification and finalization failed");
}

async function verifyFailureFinalization() {
  let sourceChecked = false;
  let primary;
  try {
    await run(process.execPath, ["--eval", "process.exit(23)"], fixtureRoot, { quiet: true });
  } catch (error) {
    primary = error;
  }
  const preserved = await expectFailure(
    "nonzero child result is preserved and source is post-checked",
    () => finalize(primary, async () => {}, async () => {
      sourceChecked = true;
      await validateInstallation(fixtureRoot);
    }),
    error => error === primary && error instanceof ChildProcessError && error.code === 23,
  );
  assert.equal(preserved, primary);
  assert(sourceChecked, "source post-check must run after a child failure");

  sourceChecked = false;
  let spawnError;
  try {
    await run(path.join(fixtureRoot, "missing-verifier-executable"), [], fixtureRoot, { quiet: true });
  } catch (error) {
    spawnError = error;
  }
  await expectFailure(
    "spawn error is preserved and source is post-checked",
    () => finalize(spawnError, async () => {}, async () => {
      sourceChecked = true;
      await validateInstallation(fixtureRoot);
    }),
    error => error === spawnError,
  );
  assert(sourceChecked, "source post-check must run after a spawn error");

  sourceChecked = false;
  const cleanupError = new Error("injected cleanup failure");
  await expectFailure(
    "cleanup error is preserved and source is post-checked",
    () => finalize(undefined, async () => {
      throw cleanupError;
    }, async () => {
      sourceChecked = true;
      await validateInstallation(fixtureRoot);
    }),
    error => error === cleanupError,
  );
  assert(sourceChecked, "source post-check must run after a cleanup error");

  const primaryError = new Error("injected primary failure");
  const integrityError = new Error("injected integrity failure");
  await expectFailure(
    "primary, cleanup, and integrity errors remain distinguishable",
    () => finalize(primaryError, async () => {
      throw cleanupError;
    }, async () => {
      throw integrityError;
    }),
    error => error instanceof AggregateError
      && error.errors.length === 3
      && error.errors[0] === primaryError
      && error.errors[1] === cleanupError
      && error.errors[2] === integrityError,
  );
}

async function verifyRejectionGates(verificationRoot) {
  const wrongVersionRoot = path.join(verificationRoot, "wrong-version");
  await copyDocx(fixtureRoot, wrongVersionRoot);
  const packageFile = path.join(wrongVersionRoot, "node_modules", "docx", "package.json");
  const packageData = JSON.parse(await readFile(packageFile, "utf8"));
  packageData.version = "0.0.0";
  await writeFile(packageFile, `${JSON.stringify(packageData, null, 2)}\n`);
  const wrongVersionHashes = await Promise.all(
    Object.keys(expected.files).map(file => sha256(path.join(wrongVersionRoot, "node_modules", "docx", file))),
  );
  await expectFailure(
    "wrong docx version aborts before patching",
    () => applyVerifiedPatch(wrongVersionRoot),
    error => error instanceof Error && error.message.includes("Version gate failed"),
  );
  assert.deepEqual(
    await Promise.all(Object.keys(expected.files).map(file => sha256(path.join(wrongVersionRoot, "node_modules", "docx", file)))),
    wrongVersionHashes,
    "wrong-version rejection must not modify runtime files",
  );

  for (const relativeFile of Object.keys(expected.files)) {
    const safeName = relativeFile.replaceAll("/", "-").replaceAll(".", "-");
    const modifiedRoot = path.join(verificationRoot, `modified-${safeName}`);
    await copyDocx(fixtureRoot, modifiedRoot);
    const changedFile = path.join(modifiedRoot, "node_modules", "docx", relativeFile);
    await appendFile(changedFile, "\n");
    const before = await Promise.all(
      Object.keys(expected.files).map(file => sha256(path.join(modifiedRoot, "node_modules", "docx", file))),
    );
    await expectFailure(
      `changed ${relativeFile} aborts before patching`,
      () => applyVerifiedPatch(modifiedRoot),
      error => error instanceof Error && error.message.includes(`Source hash gate failed for docx/${relativeFile}`),
    );
    assert.deepEqual(
      await Promise.all(Object.keys(expected.files).map(file => sha256(path.join(modifiedRoot, "node_modules", "docx", file)))),
      before,
      `${relativeFile} rejection must not modify runtime files`,
    );
  }

  await verifyFailureFinalization();
}

async function copyFixture(verificationRoot) {
  const isolatedRoot = path.join(verificationRoot, "patched-installation");
  await mkdir(isolatedRoot);
  await Promise.all([
    cp(path.join(fixtureRoot, "node_modules"), path.join(isolatedRoot, "node_modules"), { recursive: true, dereference: true }),
    cp(path.join(fixtureRoot, "package.json"), path.join(isolatedRoot, "package.json")),
    cp(path.join(fixtureRoot, "package-lock.json"), path.join(isolatedRoot, "package-lock.json")),
    cp(path.join(fixtureRoot, "replacement.test.mjs"), path.join(isolatedRoot, "replacement.test.mjs")),
  ]);
  return isolatedRoot;
}

async function verify() {
  const beforeHashes = await validateInstallation(fixtureRoot);
  let verificationRoot;
  let primaryError;
  try {
    const sourceEntrypoints = await resolveEntrypoints(fixtureRoot);
    console.log(`Node ${process.version}`);
    console.log(`docx@${expected.version}`);
    console.log(`Require entrypoint: ${path.relative(fixtureRoot, sourceEntrypoints.requireTarget)}`);
    console.log(`Import entrypoint: ${path.relative(fixtureRoot, sourceEntrypoints.importTarget)}`);

    verificationRoot = await mkdtemp(path.join(os.tmpdir(), "docx-repeated-blocks-"));
    await verifyRejectionGates(verificationRoot);

    const isolatedRoot = await copyFixture(verificationRoot);
    await validateInstallation(isolatedRoot);
    await resolveEntrypoints(isolatedRoot);
    await applyVerifiedPatch(isolatedRoot);
    await run(process.execPath, ["--test", "replacement.test.mjs"], isolatedRoot);
  } catch (error) {
    primaryError = error;
  }

  await finalize(
    primaryError,
    async () => {
      if (verificationRoot) {
        await rm(verificationRoot, { recursive: true, force: true });
        console.log(`CLEAN [temporary] ${path.basename(verificationRoot)}`);
      }
    },
    async () => {
      const afterHashes = await validateInstallation(fixtureRoot);
      assert.deepEqual(afterHashes, beforeHashes, "original dependency hashes changed during verification");
      console.log("PASS [isolation] original dependency hashes unchanged");
    },
  );
  console.log("PASS 46 scenarios: 23 ESM, 23 CommonJS");
}

await verify();
