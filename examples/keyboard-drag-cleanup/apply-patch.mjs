#!/usr/bin/env node

import {createHash} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {lstat, readFile, realpath} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {dirname, join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const recipeRoot = dirname(fileURLToPath(import.meta.url))
const patchPath = join(recipeRoot, 'patches/react-aria+3.52.1.patch')
const manifest = JSON.parse(await readFile(join(recipeRoot, 'original-hashes.json'), 'utf8'))

function fail(message) {
  console.error(message)
  process.exitCode = 1
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex')
}

function runGit(args, cwd) {
  const [command, ...options] = args
  const result = spawnSync('git', [command, '--unsafe-paths', `--directory=${cwd}`, ...options], {
    cwd: tmpdir(),
    encoding: 'utf8',
  })
  if (result.error) {
    throw new Error(`Could not run git: ${result.error.message}`)
  }
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `git ${args.join(' ')} failed`)
  }
}

async function main() {
  if (process.argv.length !== 3) {
    throw new Error('Usage: node apply-patch.mjs <installation-directory>')
  }

  const installation = await realpath(resolve(process.argv[2]))
  const packageRoot = join(installation, 'node_modules', manifest.package)
  const packageRootStat = await lstat(packageRoot)
  if (!packageRootStat.isDirectory() || packageRootStat.isSymbolicLink()) {
    throw new Error(`Expected a regular package directory at ${packageRoot}`)
  }

  const packageJson = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
  if (packageJson.name !== manifest.package) {
    throw new Error(`Expected ${manifest.package} at ${packageRoot}, received ${JSON.stringify(packageJson.name)}`)
  }
  if (packageJson.version !== manifest.version) {
    throw new Error(`Unsupported ${manifest.package} version ${JSON.stringify(packageJson.version)}; expected exactly ${manifest.version}`)
  }

  const patchText = await readFile(patchPath, 'utf8')
  const declaredPaths = [...patchText.matchAll(/^diff --git a\/(.+) b\/(.+)$/gm)].map((match) => {
    if (match[1] !== match[2]) {
      throw new Error(`Patch renames are not supported: ${match[1]} -> ${match[2]}`)
    }
    return match[1]
  })
  const expectedPatchPaths = Object.keys(manifest.files).map((file) => `node_modules/${manifest.package}/${file}`).sort()
  assertSamePaths(declaredPaths.sort(), expectedPatchPaths)

  const states = []
  for (const [relativePath, hashes] of Object.entries(manifest.files)) {
    const targetPath = join(packageRoot, relativePath)
    const targetStat = await lstat(targetPath)
    if (!targetStat.isFile() || targetStat.isSymbolicLink()) {
      throw new Error(`Expected a regular file at ${targetPath}`)
    }
    const hash = sha256(await readFile(targetPath))
    states.push({relativePath, hash, hashes})
  }

  if (states.every(({hash, hashes}) => hash === hashes.patched)) {
    console.log(`${manifest.package} ${manifest.version} patch is already applied.`)
    return
  }

  if (!states.every(({hash, hashes}) => hash === hashes.original)) {
    const details = states
      .filter(({hash, hashes}) => hash !== hashes.original)
      .map(({relativePath, hash}) => `  ${relativePath}: ${hash}`)
      .join('\n')
    throw new Error(`Refusing to patch unknown or mixed ${manifest.package} files. Reinstall the exact official ${manifest.version} package first.\n${details}`)
  }

  runGit(['apply', '--check', '--whitespace=nowarn', patchPath], installation)
  runGit(['apply', '--whitespace=nowarn', patchPath], installation)

  for (const {relativePath, hashes} of states) {
    const hash = sha256(await readFile(join(packageRoot, relativePath)))
    if (hash !== hashes.patched) {
      throw new Error(`Post-application hash mismatch for ${relativePath}: ${hash}`)
    }
  }

  console.log(`Applied ${manifest.package} ${manifest.version} keyboard drag cleanup patch (${states.length} files).`)
}

function assertSamePaths(actual, expected) {
  if (actual.length !== expected.length || actual.some((path, index) => path !== expected[index])) {
    throw new Error(`Patch target list does not match original-hashes.json.\nPatch: ${actual.join(', ')}\nManifest: ${expected.join(', ')}`)
  }
}

try {
  await main()
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
}
