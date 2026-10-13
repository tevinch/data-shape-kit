const fs = require('node:fs/promises')
const path = require('node:path')
const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const { build } = require('esbuild')

;(async () => {
  const base = __dirname
  const installed = path.join(base, 'node_modules/alpinejs')
  const pkg = JSON.parse(await fs.readFile(path.join(installed, 'package.json'), 'utf8'))
  assert.equal(pkg.version, '3.17.4', 'This example only supports Alpine 3.17.4')
  const relative = 'src/directives/x-modelable.js'
  const source = await fs.readFile(path.join(installed, relative), 'utf8')
  assert.equal(createHash('sha256').update(source).digest('hex'), 'b0d8b1a445f02e6c940f4813b5c36f7c3de3599dd65123fc297d901547e31c47', 'Unexpected upstream source; review the new version before applying')
  const corrected = source
    .replace("import { directive } from '../directives'", "import { directive } from '../directives'\nimport { skipDuringClone } from '../clone'")
    .replace("directive('modelable', (", "directive('modelable', skipDuringClone((")
    .replace(/\}\)\s*$/, '}))\n')
  const copy = path.join(base, '.build/alpinejs')
  await fs.rm(copy, { recursive: true, force: true })
  await fs.mkdir(copy, { recursive: true })
  for (const dir of ['src', 'builds']) await fs.cp(path.join(installed, dir), path.join(copy, dir), { recursive: true })
  await fs.writeFile(path.join(copy, relative), corrected)
  for (const [entry, output, format] of [['cdn', 'alpine.js', 'iife'], ['module', 'alpine.esm.js', 'esm']]) {
    await build({ entryPoints: [path.join(copy, `builds/${entry}.js`)], outfile: path.join(base, 'dist', output), bundle: true, format, define: { ALPINE_VERSION: JSON.stringify('3.17.4-local-modelable'), 'process.env.NODE_ENV': JSON.stringify('production') } })
  }
  console.log('Built local Alpine 3.17.4 with the x-modelable clone guard; installed packages unchanged.')
})().catch(error => { console.error(error); process.exitCode = 1 })
