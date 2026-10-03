import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import {performance} from 'node:perf_hooks'

const [rootArg, output, mode = 'verify', referenceFile] = process.argv.slice(2)
const root = path.resolve(rootArg)
const require = createRequire(path.join(root, 'package.json'))
const {micromark, parse, postprocess, preprocess} = await import(pathToFileURL(require.resolve('micromark')))
const {stream} = await import(pathToFileURL(require.resolve('micromark/stream')))
const {commonmark} = await import(pathToFileURL(require.resolve('commonmark.json')))
const digest = value => createHash('sha256').update(value).digest('hex')
const kinds = [['quotes', '> a\n\n'], ['lists', '- a\n  - b\n'], ['setext', 'a\n=\n']]
const cases = kinds.flatMap(([name, unit]) => [8192, 32768].map(size => ({name: `${name}-${size}`, text: unit.repeat(Math.ceil(size / unit.length))})))
cases.push({name: 'readme', text: fs.readFileSync(referenceFile ? path.resolve(referenceFile) : path.join(root, 'readme.md'), 'utf8')})
cases.push({name: 'small', text: 'Hello *world*.\n\n> A note.\n\n- one\n- two\n'})
const p = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.\n'
cases.push({name: 'sections', text: Array.from({length: 700}, (_, i) => `Section ${i}\n----------\n\n${p}${p}\n> ${p}\n- Item\n- Item\n\n`).join('')})
const result = {node: process.version, platform: process.platform, arch: process.arch, mode, cases: []}
for (const {name, text} of cases) {
  // Warm up a bounded input before each measured document or batch.
  micromark(text.slice(0, Math.min(text.length, 1024)))
  const iterations = name === 'small' ? 1000 : 1
  const start = performance.now()
  let html
  for (let i = 0; i < iterations; i++) html = micromark(text)
  const milliseconds = (performance.now() - start) / iterations
  assert.equal(typeof html, 'string')
  assert.ok(html.length > 0)
  const row = {name, bytes: Buffer.byteLength(text), milliseconds, iterations, htmlHash: digest(html)}
  if (mode === 'verify') {
    const events = postprocess(parse().document().write(preprocess()(text, undefined, true)))
    row.eventHash = digest(JSON.stringify(events.map(([kind, token]) => [kind, token.type, token.start, token.end])))
    row.events = events.length
    let chunks = 0
    let streamHtml = ''
    const parser = stream()
    const finished = new Promise((resolve, reject) => {
      parser.on('data', chunk => { streamHtml += chunk; chunks++ })
      parser.on('error', reject)
      parser.on('end', resolve)
    })
    let writes = 0
    for (let i = 0; i < text.length; i += 257) { parser.write(text.slice(i, i + 257)); writes++ }
    parser.end()
    await finished
    assert.ok(writes > 0 && chunks > 0)
    assert.equal(streamHtml, html)
    row.stream = {writes, chunks, htmlHash: digest(streamHtml), ended: true}
  }
  result.cases.push(row)
  console.log(JSON.stringify({name, milliseconds: +milliseconds.toFixed(2), mode}))
}
if (mode === 'verify') {
  const specHashes = []
  for (const fixture of commonmark) {
    const options = {allowDangerousHtml: true, allowDangerousProtocol: true}
    const html = micromark(fixture.markdown, options)
    assert.equal(html, fixture.html)
    const events = postprocess(parse(options).document().write(preprocess()(fixture.markdown, undefined, true)))
    specHashes.push(digest(JSON.stringify([html, events.map(([kind, token]) => [kind, token.type, token.start, token.end])])))
  }
  result.spec = {count: specHashes.length, hashes: specHashes}
  assert.equal(result.spec.count, 652)
  assert.equal(result.cases.length, 9)
  const expected = JSON.parse(fs.readFileSync(new URL('expected.json', import.meta.url), 'utf8'))
  assert.deepEqual(result.spec, expected.spec)
  for (let index = 0; index < expected.cases.length; index++) {
    for (const key of ['name', 'bytes', 'htmlHash', 'eventHash', 'events', 'stream']) {
      assert.deepEqual(result.cases[index][key], expected.cases[index][key], `${result.cases[index].name}: ${key}`)
    }
  }
}
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n')
