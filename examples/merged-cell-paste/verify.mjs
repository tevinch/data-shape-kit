import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { cp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const patchPath = path.join(root, "patches", "prosemirror-tables+1.8.5.patch");
const expectedVersion = "1.8.5";
const expectedHashes = new Map([
  ["dist/index.js", "86226413762b2b8d88356f83e691a770d7b1d1c3b8de7e2de6bf25d785593cdf"],
  ["dist/index.cjs", "5585e5bbdc0ac587242249e624194f3ebbfcc71fc93d102197341124c8b9f8cd"],
]);
const reportedPackages = [
  "prosemirror-tables",
  "prosemirror-model",
  "prosemirror-state",
  "@tiptap/core",
  "@tiptap/extension-table",
  "@tiptap/extension-document",
  "@tiptap/extension-paragraph",
  "@tiptap/extension-text",
  "jsdom",
];

async function sha256(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

async function packageVersion(installationRoot, packageName) {
  const packageFile = path.join(installationRoot, "node_modules", packageName, "package.json");
  return JSON.parse(await readFile(packageFile, "utf8")).version;
}

async function validateInstallation(installationRoot) {
  const packageRoot = path.join(installationRoot, "node_modules", "prosemirror-tables");
  const actualVersion = await packageVersion(installationRoot, "prosemirror-tables");
  if (actualVersion !== expectedVersion) {
    throw new Error(
      `Version gate failed: expected prosemirror-tables ${expectedVersion}, found ${actualVersion}`,
    );
  }
  const hashes = new Map();
  for (const [relativeFile, expectedHash] of expectedHashes) {
    const actualHash = await sha256(path.join(packageRoot, relativeFile));
    hashes.set(relativeFile, actualHash);
    if (actualHash !== expectedHash) {
      throw new Error(
        `Source hash gate failed for prosemirror-tables/${relativeFile}: expected ${expectedHash}, found ${actualHash}`,
      );
    }
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
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${command} ${args.join(" ")} ended with signal ${signal}`));
      } else if (code !== 0 && !allowFailure) {
        reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
      } else {
        resolve(code);
      }
    });
  });
}

async function expectGateFailure(label, installationRoot, expectedMessage) {
  await assert.rejects(
    validateInstallation(installationRoot),
    (error) => error instanceof Error && error.message.includes(expectedMessage),
    `${label} must fail before patch application`,
  );
  console.log(`PASS [gate] ${label}`);
}

async function copyTargetPackage(sourceRoot, destinationRoot) {
  const destination = path.join(destinationRoot, "node_modules", "prosemirror-tables");
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(
    path.join(sourceRoot, "node_modules", "prosemirror-tables"),
    destination,
    { recursive: true, dereference: true },
  );
}

async function verifyRejectionGates(verificationRoot) {
  const wrongVersionRoot = path.join(verificationRoot, "wrong-version");
  await copyTargetPackage(root, wrongVersionRoot);
  const wrongPackageFile = path.join(
    wrongVersionRoot,
    "node_modules",
    "prosemirror-tables",
    "package.json",
  );
  const wrongPackage = JSON.parse(await readFile(wrongPackageFile, "utf8"));
  wrongPackage.version = "1.8.4";
  await writeFile(wrongPackageFile, `${JSON.stringify(wrongPackage, null, 2)}\n`);
  await expectGateFailure("wrong version rejected", wrongVersionRoot, "Version gate failed");

  const modifiedSourceRoot = path.join(verificationRoot, "modified-source");
  await copyTargetPackage(root, modifiedSourceRoot);
  const modifiedFile = path.join(
    modifiedSourceRoot,
    "node_modules",
    "prosemirror-tables",
    "dist",
    "index.js",
  );
  await writeFile(modifiedFile, `${await readFile(modifiedFile, "utf8")}\n`);
  await expectGateFailure(
    "modified source rejected",
    modifiedSourceRoot,
    "Source hash gate failed",
  );
}

async function runReproduction() {
  await validateInstallation(root);
  await printVersions(root);
  let failureCount = 0;
  for (const mode of ["esm", "cjs", "tiptap"]) {
    console.log(`RUN [${mode}] unmodified dependency`);
    const exitCode = await run(
      process.execPath,
      [path.join(root, "scenario-runner.mjs"), mode],
      root,
      { allowFailure: true },
    );
    if (exitCode === 0) {
      throw new Error(`Expected the unmodified ${mode} scenario to reproduce the known failure`);
    }
    failureCount += 1;
  }
  throw new Error(`Known merged-cell selection failure reproduced in ${failureCount} modes`);
}

async function runPatchedVerification() {
  const beforeHashes = await validateInstallation(root);
  await printVersions(root);
  const verificationRoot = path.join(root, `.verification-${randomUUID()}`);
  let failure;
  try {
    await mkdir(verificationRoot);
    await verifyRejectionGates(verificationRoot);

    const isolatedRoot = path.join(verificationRoot, "patched-installation");
    await mkdir(isolatedRoot);
    await Promise.all([
      cp(path.join(root, "node_modules"), path.join(isolatedRoot, "node_modules"), {
        recursive: true,
        dereference: true,
      }),
      cp(path.join(root, "scenario-runner.mjs"), path.join(isolatedRoot, "scenario-runner.mjs")),
      cp(path.join(root, "package.json"), path.join(isolatedRoot, "package.json")),
    ]);

    await validateInstallation(isolatedRoot);
    const resolvedPackage = await realpath(
      path.join(isolatedRoot, "node_modules", "prosemirror-tables"),
    );
    assert(
      resolvedPackage.startsWith(`${isolatedRoot}${path.sep}`),
      `Isolated dependency resolved outside temporary installation: ${resolvedPackage}`,
    );

    console.log("RUN [patch] git apply --check");
    await run("git", ["apply", "--check", patchPath], isolatedRoot);
    console.log("RUN [patch] git apply");
    await run("git", ["apply", patchPath], isolatedRoot);

    for (const mode of ["esm", "cjs", "tiptap"]) {
      console.log(`RUN [${mode}] patched temporary installation`);
      await run(process.execPath, ["scenario-runner.mjs", mode], isolatedRoot);
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
  console.log("PASS 23 scenarios: 9 ESM, 9 CJS, 5 Tiptap");
}

if (process.argv.includes("--reproduce")) await runReproduction();
else await runPatchedVerification();
