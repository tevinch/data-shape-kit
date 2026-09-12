import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {cp, mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import test, {after} from 'node:test'

const exampleRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const sourcePackage = join(exampleRoot, 'node_modules/react-aria')
const manifest = JSON.parse(await readFile(join(exampleRoot, 'original-hashes.json'), 'utf8'))
const targetFiles = Object.keys(manifest.files)
const tempRoots = []

after(async () => {
  await Promise.all(tempRoots.map((root) => rm(root, {recursive: true, force: true})))
})

async function createInstallation(label) {
  const root = await mkdtemp(join(tmpdir(), `keyboard-drag-${label}-`))
  tempRoots.push(root)
  await cp(sourcePackage, join(root, 'node_modules/react-aria'), {recursive: true})
  return root
}

function applyPatch(installation) {
  return spawnSync(process.execPath, [join(exampleRoot, 'apply-patch.mjs'), installation], {
    encoding: 'utf8',
  })
}

async function targetBytes(installation) {
  return Promise.all(targetFiles.map((file) => readFile(join(installation, 'node_modules/react-aria', file))))
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex')
}

test('applies all files together, is idempotent, and leaves a control installation unchanged', async () => {
  const candidate = await createInstallation('candidate')
  const control = await createInstallation('control')
  const controlBefore = await targetBytes(control)

  const first = applyPatch(candidate)
  assert.equal(first.status, 0, first.stderr || first.stdout)
  const patchedBytes = await targetBytes(candidate)
  assert.deepEqual(
    patchedBytes.map(sha256),
    targetFiles.map((file) => manifest.files[file].patched),
  )

  const second = applyPatch(candidate)
  assert.equal(second.status, 0, second.stderr || second.stdout)
  assert.match(second.stdout, /already applied/i)
  assert.deepEqual(await targetBytes(candidate), patchedBytes)
  assert.deepEqual(await targetBytes(control), controlBefore)
})

test('applies relative to an installation nested in an unrelated Git repository', async () => {
  const repository = await mkdtemp(join(tmpdir(), 'keyboard-drag-repository-'))
  tempRoots.push(repository)
  const initialized = spawnSync('git', ['init', '--quiet'], {cwd: repository, encoding: 'utf8'})
  assert.equal(initialized.status, 0, initialized.stderr || initialized.stdout)

  const installation = join(repository, 'nested/application')
  await mkdir(installation, {recursive: true})
  await cp(sourcePackage, join(installation, 'node_modules/react-aria'), {recursive: true})

  const result = applyPatch(installation)
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.deepEqual(
    (await targetBytes(installation)).map(sha256),
    targetFiles.map((file) => manifest.files[file].patched),
  )
})

test('rejects a wrong package version before changing any target', async () => {
  const installation = await createInstallation('wrong-version')
  const packageJsonPath = join(installation, 'node_modules/react-aria/package.json')
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'))
  packageJson.version = '3.52.0'
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)
  const before = await targetBytes(installation)

  const result = applyPatch(installation)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /expected exactly 3\.52\.1/i)
  assert.deepEqual(await targetBytes(installation), before)
})

test('rejects an altered target without changing any file', async () => {
  const installation = await createInstallation('altered')
  const alteredPath = join(installation, 'node_modules/react-aria', targetFiles[0])
  await writeFile(alteredPath, Buffer.concat([await readFile(alteredPath), Buffer.from('\n// altered\n')]))
  const before = await targetBytes(installation)

  const result = applyPatch(installation)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /unknown or mixed/i)
  assert.deepEqual(await targetBytes(installation), before)
})

test('rejects mixed original and patched bytes without another write', async () => {
  const installation = await createInstallation('mixed')
  const first = applyPatch(installation)
  assert.equal(first.status, 0, first.stderr || first.stdout)
  const originalFile = await readFile(join(sourcePackage, targetFiles[0]))
  await writeFile(join(installation, 'node_modules/react-aria', targetFiles[0]), originalFile)
  const before = await targetBytes(installation)

  const result = applyPatch(installation)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /unknown or mixed/i)
  assert.deepEqual(await targetBytes(installation), before)
})
