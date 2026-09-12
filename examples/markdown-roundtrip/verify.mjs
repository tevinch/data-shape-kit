import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, "original-hashes.json"), "utf8"));
const patches = [
  "@tiptap+markdown+3.31.3.patch",
  "@tiptap+extension-code+3.31.3.patch",
  "@tiptap+extension-table+3.31.3.patch",
];
const reportedPackages = [
  "@tiptap/core",
  "@tiptap/markdown",
  "@tiptap/starter-kit",
  "@tiptap/extension-code",
  "@tiptap/extension-table",
  "marked",
  "jsdom",
];

async function sha256(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

async function packageVersion(installationRoot, packageName) {
  const packageFile = path.join(installationRoot, "node_modules", packageName, "package.json");
  return JSON.parse(await readFile(packageFile, "utf8")).version;
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
    const file = path.join(installationRoot, "node_modules", packageName, relativeFile);
    const actualHash = await sha256(file);
    hashes[`${packageName}/${relativeFile}`] = actualHash;
    if (actualHash !== expectedHash) {
      throw new Error(
        `Source hash gate failed for ${packageName}/${relativeFile}: expected ${expectedHash}, found ${actualHash}`,
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

async function printVersions(installationRoot) {
  const versions = [];
  for (const packageName of reportedPackages) {
    versions.push(`${packageName}@${await packageVersion(installationRoot, packageName)}`);
  }
  console.log(`Node ${process.version}`);
  console.log(`Versions: ${versions.join(", ")}`);
}

function run(command, args, cwd, { allowFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        GIT_CEILING_DIRECTORIES: root,
        NODE_PATH: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    for (const stream of [child.stdout, child.stderr]) {
      stream.on("data", chunk => {
        const text = chunk.toString();
        output += text;
        process.stdout.write(text);
      });
    }
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${command} ${args.join(" ")} ended with signal ${signal}`));
      } else if (code !== 0 && !allowFailure) {
        reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
      } else {
        resolve({ code, output });
      }
    });
  });
}

async function copyPackage(sourceRoot, destinationRoot, packageName) {
  const destination = path.join(destinationRoot, "node_modules", packageName);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(path.join(sourceRoot, "node_modules", packageName), destination, {
    recursive: true,
    dereference: true,
  });
}

async function expectGateFailure(label, operation, expectedMessage) {
  await assert.rejects(
    operation,
    error => error instanceof Error && error.message.includes(expectedMessage),
    `${label} must fail before patch application`,
  );
  console.log(`PASS [gate] ${label}`);
}

async function verifyRejectionGates(verificationRoot) {
  for (const [packageName, expected] of Object.entries(manifest)) {
    const safeName = packageName.replaceAll("/", "-").replaceAll("@", "");
    const wrongVersionRoot = path.join(verificationRoot, `wrong-version-${safeName}`);
    await copyPackage(root, wrongVersionRoot, packageName);
    const packageFile = path.join(wrongVersionRoot, "node_modules", packageName, "package.json");
    const packageData = JSON.parse(await readFile(packageFile, "utf8"));
    packageData.version = "0.0.0";
    await writeFile(packageFile, `${JSON.stringify(packageData, null, 2)}\n`);
    await expectGateFailure(
      `${packageName} wrong version rejected`,
      validatePackage(wrongVersionRoot, packageName, expected),
      "Version gate failed",
    );

    const modifiedSourceRoot = path.join(verificationRoot, `modified-source-${safeName}`);
    await copyPackage(root, modifiedSourceRoot, packageName);
    const firstFile = Object.keys(expected.files)[0];
    const modifiedFile = path.join(modifiedSourceRoot, "node_modules", packageName, firstFile);
    await writeFile(modifiedFile, `${await readFile(modifiedFile, "utf8")}\n`);
    await expectGateFailure(
      `${packageName} modified source rejected`,
      validatePackage(modifiedSourceRoot, packageName, expected),
      "Source hash gate failed",
    );
  }
}

function assertBehavioralReproduction(mode, result) {
  if (result.code === 0) {
    throw new Error(`Expected the unmodified ${mode} suite to reproduce known failures`);
  }
  assert.match(result.output, new RegExp(`RESULT \\[${mode}\\] \\d+ passed, [1-9]\\d* failed`));
  assert.match(result.output, new RegExp(`PASS \\[${mode}\\] plain paragraph control`));
  assert.match(result.output, new RegExp(`PASS \\[${mode}\\] ordinary table control`));
  assert.match(result.output, new RegExp(`FAIL \\[${mode}\\] one embedded backtick`));
  assert.match(result.output, new RegExp(`FAIL \\[${mode}\\] pipes at each position`));
  assert.match(
    result.output,
    new RegExp(`FAIL \\[${mode}\\] escaped literal tick before code with repeated spaces`),
  );
  assert.match(
    result.output,
    new RegExp(`FAIL \\[${mode}\\] escaped literal tick before code with edge spaces`),
  );
  assert.match(
    result.output,
    new RegExp(`FAIL \\[${mode}\\] escaped literal tick before whitespace-only code`),
  );
  assert.match(
    result.output,
    new RegExp(`FAIL \\[${mode}\\] escaped literal tick before code with odd-backslash pipe`),
  );
}

async function runReproduction() {
  await validateInstallation(root);
  await printVersions(root);
  for (const mode of ["esm", "cjs"]) {
    console.log(`RUN [${mode}] unmodified dependencies`);
    const result = await run(process.execPath, ["roundtrip.test.mjs", mode], root, {
      allowFailure: true,
    });
    assertBehavioralReproduction(mode, result);
  }
  throw new Error("Known Markdown content-loss failures reproduced in ESM and CJS");
}

async function runPatchedVerification() {
  const beforeHashes = await validateInstallation(root);
  await printVersions(root);
  const verificationRoot = await mkdtemp(path.join(os.tmpdir(), "markdown-roundtrip-"));
  let failure;
  try {
    await verifyRejectionGates(verificationRoot);

    const isolatedRoot = path.join(verificationRoot, "patched-installation");
    await mkdir(isolatedRoot);
    await Promise.all([
      cp(path.join(root, "node_modules"), path.join(isolatedRoot, "node_modules"), {
        recursive: true,
        dereference: true,
      }),
      cp(path.join(root, "roundtrip.test.mjs"), path.join(isolatedRoot, "roundtrip.test.mjs")),
      cp(path.join(root, "package.json"), path.join(isolatedRoot, "package.json")),
    ]);

    await validateInstallation(isolatedRoot);
    const isolatedRealRoot = await realpath(isolatedRoot);
    for (const packageName of Object.keys(manifest)) {
      const resolvedPackage = await realpath(path.join(isolatedRoot, "node_modules", packageName));
      assert(
        resolvedPackage.startsWith(`${isolatedRealRoot}${path.sep}`),
        `${packageName} resolved outside the temporary installation: ${resolvedPackage}`,
      );
    }

    for (const patchFile of patches) {
      console.log(`RUN [patch-check] ${patchFile}`);
      await run("git", ["apply", "--check", path.join(root, "patches", patchFile)], isolatedRoot);
    }
    for (const patchFile of patches) {
      console.log(`RUN [patch] ${patchFile}`);
      await run("git", ["apply", path.join(root, "patches", patchFile)], isolatedRoot);
    }

    for (const mode of ["esm", "cjs"]) {
      console.log(`RUN [${mode}] patched temporary installation`);
      await run(process.execPath, ["roundtrip.test.mjs", mode], isolatedRoot);
    }
  } catch (error) {
    failure = error;
  } finally {
    await rm(verificationRoot, { recursive: true, force: true });
    console.log(`CLEAN [temporary] ${path.basename(verificationRoot)}`);
  }

  try {
    const afterHashes = await validateInstallation(root);
    assert.deepEqual(afterHashes, beforeHashes, "Original dependency hashes changed during verification");
    console.log("PASS [isolation] original dependency hashes unchanged");
  } catch (error) {
    failure = failure ? new AggregateError([failure, error], "Verification and isolation failed") : error;
  }

  if (failure) throw failure;
  console.log("PASS 62 scenarios: 31 ESM, 31 CJS");
}

if (process.argv.includes("--reproduce")) await runReproduction();
else await runPatchedVerification();
