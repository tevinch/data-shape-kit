#!/usr/bin/env node

import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {spawn, spawnSync} from 'node:child_process'
import {cp, mkdtemp, readFile, rm, symlink} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {tmpdir} from 'node:os'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const exampleRoot = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const manifest = JSON.parse(await readFile(join(exampleRoot, 'original-hashes.json'), 'utf8'))
const installedPackageRoot = dirname(require.resolve('react-aria/package.json'))
const viteBin = join(dirname(require.resolve('vite/package.json')), 'bin/vite.js')
const playwrightBin = join(dirname(require.resolve('@playwright/test/package.json')), 'cli.js')
const tscBin = join(dirname(require.resolve('typescript/package.json')), 'bin/tsc')
const mode = process.argv[2]

if (!['--original', '--patched', '--dev'].includes(mode)) {
  throw new Error('Usage: node verify.mjs --original|--patched|--dev')
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex')
}

async function verifyInstalledState(expectedState) {
  const packageJson = JSON.parse(await readFile(join(installedPackageRoot, 'package.json'), 'utf8'))
  assert.equal(packageJson.version, manifest.version, `react-aria must be exactly ${manifest.version}`)
  for (const [relativePath, hashes] of Object.entries(manifest.files)) {
    const actual = sha256(await readFile(join(installedPackageRoot, relativePath)))
    assert.equal(actual, hashes[expectedState], `${relativePath} must be ${expectedState}`)
  }
}

function cleanEnvironment(extra = {}) {
  const environment = {...process.env, ...extra}
  delete environment.FORCE_COLOR
  delete environment.NO_COLOR
  return environment
}

function runNode(args, options = {}) {
  return spawnSync(process.execPath, args, {
    cwd: exampleRoot,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    env: cleanEnvironment(options.env),
  })
}

function requireSuccess(result, label) {
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    process.stdout.write(result.stdout)
    process.stderr.write(result.stderr)
    throw new Error(`${label} failed with exit code ${result.status}`)
  }
  process.stdout.write(result.stdout)
  process.stderr.write(result.stderr)
}

async function makeInstallation() {
  const installation = await mkdtemp(join(tmpdir(), 'keyboard-drag-installation-'))
  const packageRoot = join(installation, 'node_modules/react-aria')
  await cp(installedPackageRoot, packageRoot, {recursive: true})
  await symlink(join(exampleRoot, 'node_modules'), join(packageRoot, 'node_modules'), 'dir')
  return {installation, packageRoot}
}

async function waitForServer(port) {
  const deadline = Date.now() + 10_000
  let lastError
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/fixture/index.html`)
      if (response.ok) return
      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`Preview server on port ${port} did not become ready: ${lastError}`)
}

async function runBrowserSuite(outDir, port, args, extraEnv = {}) {
  const server = spawn(process.execPath, [viteBin, 'preview', '--outDir', outDir, '--host', '127.0.0.1', '--port', String(port)], {
    cwd: exampleRoot,
    env: cleanEnvironment(),
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let serverOutput = ''
  server.stdout.on('data', (chunk) => { serverOutput += chunk })
  server.stderr.on('data', (chunk) => { serverOutput += chunk })

  try {
    await waitForServer(port)
    const result = runNode([playwrightBin, 'test', 'tests/drag-cleanup.spec.ts', ...args], {
      env: {FIXTURE_PORT: String(port), ...extraEnv},
    })
    return result
  } finally {
    server.kill('SIGTERM')
    await new Promise((resolve) => {
      if (server.exitCode !== null) resolve()
      else server.once('exit', resolve)
    })
    if (server.exitCode && server.exitCode !== 143) {
      process.stderr.write(serverOutput)
    }
  }
}

async function buildFixture(packageRoot, format, outDir) {
  const result = runNode([viteBin, 'build', '--outDir', outDir, '--emptyOutDir'], {
    env: {REACT_ARIA_PACKAGE_ROOT: packageRoot, REACT_ARIA_FORMAT: format},
  })
  requireSuccess(result, `${format} browser build`)
}

async function reportBrowserVersions() {
  const {chromium, firefox} = await import('playwright')
  for (const [name, browserType] of [['Chromium', chromium], ['Firefox', firefox]]) {
    const browser = await browserType.launch({headless: true})
    try {
      console.log(`${name}: ${browser.version()}`)
    } finally {
      await browser.close()
    }
  }
}

async function reproduce() {
  await verifyInstalledState('original')
  const {installation, packageRoot} = await makeInstallation()
  const outDir = join(installation, 'build-original-mjs')
  try {
    await buildFixture(packageRoot, 'mjs', outDir)
    const result = await runBrowserSuite(
      outDir,
      4173,
      ['--project=chromium', '--grep', 'source ancestor collapse.*LTR'],
      {REPRODUCE_MODE: '1'},
    )
    const output = `${result.stdout}\n${result.stderr}`
    process.stdout.write(result.stdout)
    process.stderr.write(result.stderr)
    if (result.status === 0) {
      throw new Error('The unmodified release unexpectedly passed the regression test.')
    }
    if (!/REPRO_SNAPSHOT.*"inertCount":3.*"focusTag":"BODY".*"outsideValue":"".*"dragEndCount":2/.test(output)) {
      throw new Error('The browser test failed without the expected lingering-session signature.')
    }
    console.error('Confirmed react-aria 3.52.1 failure: inert state remains, focus is BODY, keyboard input is swallowed, and Escape emits a second cancel event.')
    process.exitCode = 1
  } finally {
    await rm(installation, {recursive: true, force: true})
  }
}

async function verifyPatched() {
  await verifyInstalledState('original')

  const requirePath = require.resolve('react-aria/useDrag')
  const importPath = import.meta.resolve('react-aria/useDrag')
  const packageJson = JSON.parse(await readFile(join(installedPackageRoot, 'package.json'), 'utf8'))
  assert.match(requirePath, /dist\/exports\/useDrag\.cjs$/)
  assert.match(importPath, /dist\/exports\/useDrag\.mjs$/)
  assert.equal(packageJson.exports['./*']['legacy-module'], './dist/exports/*.js')
  console.log('Resolved package entries: import=.mjs, require=.cjs, legacy-module=.js')

  requireSuccess(runNode([tscBin, '--noEmit']), 'typecheck')
  requireSuccess(runNode(['--test', 'tests/applicator.test.mjs']), 'applicator controls')

  const {installation, packageRoot} = await makeInstallation()
  try {
    requireSuccess(runNode([join(exampleRoot, 'apply-patch.mjs'), installation]), 'patch application')
    for (const [relativePath, hashes] of Object.entries(manifest.files)) {
      assert.equal(sha256(await readFile(join(packageRoot, relativePath))), hashes.patched)
    }

    let port = 4173
    for (const format of ['mjs', 'js', 'cjs']) {
      const outDir = join(installation, `build-patched-${format}`)
      await buildFixture(packageRoot, format, outDir)
      const result = await runBrowserSuite(outDir, port, [])
      requireSuccess(result, `${format} Chromium/Firefox browser suite`)
      port += 1
    }
  } finally {
    await rm(installation, {recursive: true, force: true})
  }

  await verifyInstalledState('original')
  await reportBrowserVersions()
  console.log('Verified patched react-aria 3.52.1 across .mjs, .js, and .cjs browser builds; the installed control remains unchanged.')
}

async function dev() {
  await verifyInstalledState('patched')
  console.log('Starting the patched interactive fixture at http://127.0.0.1:5173/fixture/index.html')
  const child = spawn(process.execPath, [viteBin, '--host', '127.0.0.1'], {
    cwd: exampleRoot,
    env: cleanEnvironment({REACT_ARIA_PACKAGE_ROOT: installedPackageRoot, REACT_ARIA_FORMAT: 'mjs'}),
    stdio: 'inherit',
  })
  await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0 || signal === 'SIGINT' || signal === 'SIGTERM') resolve()
      else reject(new Error(`Vite exited with code ${code}`))
    })
  })
}

if (mode === '--original') await reproduce()
else if (mode === '--patched') await verifyPatched()
else await dev()
