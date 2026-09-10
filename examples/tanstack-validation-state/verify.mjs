import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  cp,
  mkdtemp,
  readFile,
  rm,
} from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const EXPECTED_VERSION = '1.33.5'
const EXPECTED_HASHES = {
  'src/FieldApi.ts':
    'a29a792ae101a0730a3191e694371f41a2c780f55130355f9c41188a74da0ef8',
  'src/FormApi.ts':
    '34495d6b0825b759ee06c873b81a43a7e5a0c5479bb31584b1188ce4f5fd9ba3',
  'dist/esm/FieldApi.js':
    'af4fbcbe297f2bed8fd11be876c8c24db442d912ab2b265f332c5a31553020e0',
  'dist/esm/FormApi.js':
    'ab119f3fccb517b8bba0e713b4abcda3cd5fcbe37bc8b088af48ff700cbadf89',
  'dist/cjs/FieldApi.cjs':
    '4da137ad3b88073ae55ae5d29913f6aa2c4b5d0b1b0a6f6d907b3b0294fb8a96',
  'dist/cjs/FormApi.cjs':
    '5418f437092239cd0f8e439ac66b65cad130303911139ab7d6449fe277580b76',
}

const fixtureRoot = dirname(fileURLToPath(import.meta.url))
const fixtureRequire = createRequire(import.meta.url)
const packageJsonPath = fixtureRequire.resolve(
  '@tanstack/form-core/package.json',
)
const installedPackageRoot = dirname(packageJsonPath)
const patchPath = join(
  fixtureRoot,
  'patches',
  '@tanstack+form-core+1.33.5.patch',
)

const mode = process.argv[2]
if (mode !== '--original' && mode !== '--patched') {
  throw new Error('Usage: node verify.mjs --original|--patched')
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex')
}

async function verifyInstalledPackage() {
  const manifest = JSON.parse(await readFile(packageJsonPath, 'utf8'))
  if (manifest.version !== EXPECTED_VERSION) {
    throw new Error(
      `Unsupported @tanstack/form-core version ${JSON.stringify(manifest.version)}; expected exactly ${EXPECTED_VERSION}`,
    )
  }

  for (const [relativePath, expectedHash] of Object.entries(EXPECTED_HASHES)) {
    const actualHash = sha256(
      await readFile(join(installedPackageRoot, relativePath)),
    )
    if (actualHash !== expectedHash) {
      throw new Error(
        `Source hash mismatch for node_modules/@tanstack/form-core/${relativePath}: expected ${expectedHash}, received ${actualHash}. Reinstall the exact official ${EXPECTED_VERSION} package before applying this patch.`,
      )
    }
  }
}

function controlledValidator(snapshot = ({ value }) => value) {
  const calls = []
  const validate = (options) => {
    let resolveResult
    const result = new Promise((resolve) => {
      resolveResult = resolve
    })
    let markReturned
    const returned = new Promise((resolve) => {
      markReturned = resolve
    })
    const call = {
      snapshot: snapshot(options),
      signal: options.signal,
      settled: false,
      returned,
      resolve(value) {
        if (call.settled) return
        call.settled = true
        resolveResult(value)
      },
    }
    calls.push(call)
    return result.then((value) => {
      markReturned()
      return value
    })
  }
  return { calls, validate }
}

async function waitForCalls(control, count) {
  const deadline = Date.now() + 2_000
  while (control.calls.length < count && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1))
  }
  assert.equal(
    control.calls.length,
    count,
    `expected ${count} validator calls before the deadline`,
  )
}

async function flushValidation() {
  await new Promise((resolve) => setImmediate(resolve))
  await new Promise((resolve) => setImmediate(resolve))
}

async function settleCall(call, value) {
  call.resolve(value)
  await call.returned
  await flushValidation()
}

async function cleanup(control, unmounts) {
  for (const call of control?.calls ?? []) call.resolve(undefined)
  await Promise.all((control?.calls ?? []).map((call) => call.returned))
  await flushValidation()
  for (const unmount of unmounts.reverse()) unmount()
}

function collectAssertions() {
  const failures = []
  return {
    equal(actual, expected, message) {
      try {
        assert.equal(actual, expected, message)
      } catch (error) {
        failures.push(error)
      }
    },
    deepEqual(actual, expected, message) {
      try {
        assert.deepEqual(actual, expected, message)
      } catch (error) {
        failures.push(error)
      }
    },
    finish() {
      if (failures.length > 0) {
        throw new AggregateError(failures, `${failures.length} assertion(s) failed`)
      }
    },
  }
}

async function overlapScenario(api, debounceMs, completionOrder) {
  const control = controlledValidator()
  const form = new api.FormApi({ defaultValues: { name: '' } })
  const field = new api.FieldApi({
    form,
    name: 'name',
    validators: {
      onChangeAsyncDebounceMs: debounceMs,
      onChangeAsync: control.validate,
    },
  })
  const unmounts = [form.mount(), field.mount()]
  const checks = collectAssertions()

  try {
    field.handleChange('old value')
    await waitForCalls(control, 1)
    field.handleChange('latest value')
    await waitForCalls(control, 2)

    checks.deepEqual(
      control.calls.map((call) => call.snapshot),
      ['old value', 'latest value'],
      'both overlapping validators must start with their public field values',
    )
    checks.equal(
      control.calls[0].signal.aborted,
      true,
      'the superseded validator signal must be aborted',
    )
    checks.equal(
      field.state.meta.isValidating,
      true,
      'the field must report both started validations as pending',
    )
    checks.equal(
      form.state.isValidating,
      true,
      'the form aggregate must include pending field validation',
    )

    if (completionOrder === 'old-first') {
      await settleCall(control.calls[0], 'Stale error')
      checks.equal(
        field.state.meta.isValidating,
        true,
        'old completion must not clear the newer field validation',
      )
      checks.equal(
        form.state.isValidating,
        true,
        'old completion must not clear the form aggregate while the newer validation is pending',
      )
      await settleCall(control.calls[1], 'Latest error')
    } else {
      await settleCall(control.calls[1], 'Latest error')
      checks.equal(
        field.state.meta.isValidating,
        true,
        'latest completion must leave the still-running superseded validator accounted for',
      )
      checks.equal(
        form.state.isValidating,
        true,
        'the form aggregate must remain pending until all started validators settle',
      )
      await settleCall(control.calls[0], 'Stale error')
    }

    checks.equal(
      field.state.meta.isValidating,
      false,
      'the field must become idle after all validators settle',
    )
    checks.equal(
      form.state.isValidating,
      false,
      'the form aggregate must become idle after all validators settle',
    )
    checks.deepEqual(
      field.state.meta.errors,
      ['Latest error'],
      'the newest validation result must own field errors',
    )
    checks.finish()
  } finally {
    await cleanup(control, unmounts)
  }
}

async function rapidSupersessionScenario(api) {
  const control = controlledValidator()
  const form = new api.FormApi({ defaultValues: { name: '' } })
  const field = new api.FieldApi({
    form,
    name: 'name',
    validators: {
      onChangeAsyncDebounceMs: 40,
      onChangeAsync: control.validate,
    },
  })
  const unmounts = [form.mount(), field.mount()]

  try {
    field.handleChange('queued old value')
    field.handleChange('queued latest value')
    await waitForCalls(control, 1)
    assert.deepEqual(
      control.calls.map((call) => call.snapshot),
      ['queued latest value'],
      'supersession before debounce must cancel the old checker',
    )
    assert.equal(
      field.state.meta.isValidating,
      true,
      'the latest waiting checker must keep the field pending',
    )
    assert.equal(
      form.state.isValidating,
      true,
      'the latest waiting checker must set the form aggregate',
    )
    await settleCall(control.calls[0], 'Latest queued error')
    assert.equal(field.state.meta.isValidating, false)
    assert.equal(form.state.isValidating, false)
    assert.deepEqual(field.state.meta.errors, ['Latest queued error'])
  } finally {
    await cleanup(control, unmounts)
  }
}

async function independentFieldsScenario(api) {
  const firstControl = controlledValidator()
  const secondControl = controlledValidator()
  const form = new api.FormApi({
    defaultValues: { first: '', second: '' },
  })
  const first = new api.FieldApi({
    form,
    name: 'first',
    validators: { onChangeAsync: firstControl.validate },
  })
  const second = new api.FieldApi({
    form,
    name: 'second',
    validators: { onChangeAsync: secondControl.validate },
  })
  const unmounts = [form.mount(), first.mount(), second.mount()]
  const checks = collectAssertions()

  try {
    first.handleChange('first value')
    second.handleChange('second value')
    await Promise.all([
      waitForCalls(firstControl, 1),
      waitForCalls(secondControl, 1),
    ])
    checks.equal(form.state.isValidating, true, 'either field must set the form aggregate')
    await settleCall(firstControl.calls[0], undefined)
    checks.equal(first.state.meta.isValidating, false)
    checks.equal(second.state.meta.isValidating, true)
    checks.equal(
      form.state.isValidating,
      true,
      'one independent pending field must keep the form aggregate active',
    )
    await settleCall(secondControl.calls[0], undefined)
    checks.equal(form.state.isValidating, false)
    checks.finish()
  } finally {
    await cleanup(firstControl, [])
    await cleanup(secondControl, unmounts)
  }
}

async function linkedFieldScenario(api) {
  const control = controlledValidator(({ fieldApi }) =>
    fieldApi.form.getFieldValue('source'),
  )
  const form = new api.FormApi({
    defaultValues: { source: '', confirmation: '' },
  })
  const source = new api.FieldApi({ form, name: 'source' })
  const confirmation = new api.FieldApi({
    form,
    name: 'confirmation',
    validators: {
      onChangeListenTo: ['source'],
      onChangeAsync: control.validate,
    },
  })
  const unmounts = [form.mount(), source.mount(), confirmation.mount()]
  const checks = collectAssertions()

  try {
    source.handleChange('old source')
    await waitForCalls(control, 1)
    source.handleChange('latest source')
    await waitForCalls(control, 2)
    checks.deepEqual(
      control.calls.map((call) => call.snapshot),
      ['old source', 'latest source'],
    )
    await settleCall(control.calls[0], 'Stale linked error')
    checks.equal(
      confirmation.state.meta.isValidating,
      true,
      'a linked field must keep its newer validation pending',
    )
    checks.equal(
      form.state.isValidating,
      true,
      'linked-field validation must set the form aggregate',
    )
    await settleCall(control.calls[1], 'Latest linked error')
    checks.equal(confirmation.state.meta.isValidating, false)
    checks.equal(form.state.isValidating, false)
    checks.deepEqual(confirmation.state.meta.errors, ['Latest linked error'])
    checks.finish()
  } finally {
    await cleanup(control, unmounts)
  }
}

async function formAsyncScenario(api) {
  const control = controlledValidator(({ value }) => value.name)
  const form = new api.FormApi({
    defaultValues: { name: '' },
    validators: { onChangeAsync: control.validate },
  })
  const field = new api.FieldApi({ form, name: 'name' })
  const unmounts = [form.mount(), field.mount()]
  const checks = collectAssertions()

  try {
    field.handleChange('form value')
    await waitForCalls(control, 1)
    checks.deepEqual(control.calls.map((call) => call.snapshot), ['form value'])
    checks.equal(form.state.isFormValidating, true)
    checks.equal(
      form.state.isValidating,
      true,
      'the aggregate must include a form-level async validator',
    )
    checks.equal(
      form.state.canSubmit,
      false,
      'canSubmit must use the same aggregate pending value',
    )
    await settleCall(control.calls[0], undefined)
    checks.equal(form.state.isFormValidating, false)
    checks.equal(form.state.isValidating, false)
    checks.finish()
  } finally {
    await cleanup(control, unmounts)
  }
}

async function idleScenario(api) {
  const form = new api.FormApi({ defaultValues: { name: '' } })
  const field = new api.FieldApi({ form, name: 'name' })
  const unmounts = [form.mount(), field.mount()]
  try {
    assert.equal(field.state.meta.isValidating, false)
    assert.equal(form.state.isValidating, false)
    field.handleChange('no async validator')
    await flushValidation()
    assert.equal(field.state.meta.isValidating, false)
    assert.equal(form.state.isValidating, false)
  } finally {
    for (const unmount of unmounts.reverse()) unmount()
  }
}

async function runSuite(api, runtimeLabel) {
  const scenarios = [
    ['overlap old-first (0ms debounce)', () => overlapScenario(api, 0, 'old-first')],
    ['overlap latest-first (0ms debounce)', () => overlapScenario(api, 0, 'latest-first')],
    ['overlap old-first (40ms debounce)', () => overlapScenario(api, 40, 'old-first')],
    ['overlap latest-first (40ms debounce)', () => overlapScenario(api, 40, 'latest-first')],
    ['rapid supersession before debounce', () => rapidSupersessionScenario(api)],
    ['multiple independent fields', () => independentFieldsScenario(api)],
    ['linked-field overlap', () => linkedFieldScenario(api)],
    ['single form-level async aggregate', () => formAsyncScenario(api)],
    ['no-async idle state', () => idleScenario(api)],
  ]
  let failures = 0

  for (const [name, scenario] of scenarios) {
    try {
      await scenario()
      console.log(`ok - ${runtimeLabel} - ${name}`)
    } catch (error) {
      failures += 1
      console.log(`not ok - ${runtimeLabel} - ${name}`)
      const assertionErrors =
        error instanceof AggregateError ? error.errors : [error]
      for (const assertionError of assertionErrors) {
        if (
          assertionError &&
          typeof assertionError === 'object' &&
          'actual' in assertionError &&
          'expected' in assertionError
        ) {
          const message = assertionError.message.replace(/\s*\n\s*/g, ' ')
          console.log(
            `  ${message} (actual: ${JSON.stringify(assertionError.actual)}, expected: ${JSON.stringify(assertionError.expected)})`,
          )
        } else {
          console.log(`  ${assertionError?.stack ?? assertionError}`)
        }
      }
    }
  }

  return { failures, total: scenarios.length }
}

async function loadRuntime(packageRoot, runtime) {
  if (runtime === 'esm') {
    return import(pathToFileURL(join(packageRoot, 'dist/esm/index.js')).href)
  }
  const requireFromPackage = createRequire(join(packageRoot, 'package.json'))
  return requireFromPackage(join(packageRoot, 'dist/cjs/index.cjs'))
}

async function runAgainst(packageRoot, labelPrefix) {
  let failures = 0
  let total = 0
  for (const runtime of ['esm', 'cjs']) {
    const result = await runSuite(
      await loadRuntime(packageRoot, runtime),
      `${labelPrefix} ${runtime.toUpperCase()}`,
    )
    failures += result.failures
    total += result.total
  }
  return { failures, total }
}

await verifyInstalledPackage()

let result
if (mode === '--original') {
  result = await runAgainst(installedPackageRoot, 'original')
} else {
  const verificationRoot = await mkdtemp(join(fixtureRoot, '.verification-'))
  const copiedPackageRoot = join(
    verificationRoot,
    'node_modules',
    '@tanstack',
    'form-core',
  )
  try {
    await cp(installedPackageRoot, copiedPackageRoot, { recursive: true })
    const gitEnvironment = {
      ...process.env,
      GIT_CEILING_DIRECTORIES: fixtureRoot,
    }
    execFileSync('git', ['apply', '--check', patchPath], {
      cwd: verificationRoot,
      env: gitEnvironment,
      stdio: 'pipe',
    })
    execFileSync('git', ['apply', patchPath], {
      cwd: verificationRoot,
      env: gitEnvironment,
      stdio: 'pipe',
    })
    result = await runAgainst(copiedPackageRoot, 'patched')
  } finally {
    await rm(verificationRoot, { recursive: true, force: true })
  }
  await verifyInstalledPackage()
}

if (result.failures > 0) {
  console.log(`failed ${result.failures} of ${result.total} scenarios`)
  process.exitCode = 1
} else {
  console.log(`passed ${result.total} of ${result.total} scenarios`)
}
