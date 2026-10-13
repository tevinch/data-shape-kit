const { chromium } = require('playwright')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const base = __dirname
const mode = process.argv[2]
const builds = {
  stable: ['node_modules/alpinejs/dist/cdn.js', 'node_modules/@alpinejs/morph/dist/cdn.js'],
  fixed: ['dist/alpine.js', 'node_modules/@alpinejs/morph/dist/cdn.js'],
}
assert(builds[mode], 'Choose stable or fixed')
const fixtures = JSON.parse(fs.readFileSync(path.join(base, 'fixtures.json'), 'utf8'))
const report = { mode, cases: [] }
;(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true })
  report.browser = await browser.version()
  const context = await browser.newContext()
  async function run(index, check) {
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    const [template, script] = fixtures[index].template
    try {
      await page.setContent(template)
      await page.addScriptTag({ content: `document.addEventListener('alpine:init', () => { ${script} });` })
      await page.addScriptTag({ path: path.join(base, builds[mode][1]) })
      await page.addScriptTag({ path: path.join(base, builds[mode][0]) })
      await page.waitForFunction(() => window.Alpine && document.querySelector('[x-data]')._x_dataStack)
      const evidence = await check(page)
      assert.deepEqual(errors, [])
      report.cases.push({ name: fixtures[index].name, passed: true, ...evidence })
    } catch (e) {
      report.cases.push({ name: fixtures[index].name, passed: false, error: e.message, pageErrors: errors })
    } finally { await page.close() }
  }
  async function text(page, selector, expected) {
    await page.waitForFunction(({ selector, expected }) => document.querySelector(selector)?.textContent === expected, { selector, expected }, { timeout: 1500 }).catch(async () => {
      assert.equal(await page.locator(selector).textContent(), expected)
    })
  }
  await run(0, async page => {
    await page.locator('#increment').click()
    await text(page, 'output', '1')
    for (let n = 2; n <= 11; n++) {
      await page.locator('#morph').click()
      await text(page, 'output', String(n))
    }
    await page.locator('#increment').click()
    await text(page, 'output', '12')
    return { morphs: 10, finalCounter: 12 }
  })
  await run(1, async page => {
    let selected = [99, 1, 2]
    await page.locator('#select-page').click()
    await text(page, '#selected', JSON.stringify(selected))
    await page.locator('#notes').fill('Keep this draft')
    for (let n = 2; n <= 11; n++) {
      selected.push(n * 2 - 1, n * 2)
      await page.locator('#next').click()
      await text(page, '#observations', String(n - 1))
      await text(page, '#selected', JSON.stringify(selected))
      await text(page, '#inner', JSON.stringify(selected))
      assert.equal(await page.locator('[data-row]').count(), 2)
      for (const row of [n * 2 - 1, n * 2]) assert(await page.locator(`[data-row="${row}"]`).isChecked())
    }
    assert.equal(await page.locator('#notes').inputValue(), 'Keep this draft')
    await page.locator('[data-row="21"]').uncheck()
    selected = selected.filter(row => row !== 21)
    await text(page, '#selected', JSON.stringify(selected))
    await page.locator('[data-row="21"]').check()
    selected.push(21)
    await text(page, '#selected', JSON.stringify(selected))
    await page.locator('#automatic').uncheck()
    await page.locator('#notes').focus()
    await page.evaluate(() => document.getElementById('next').click())
    await text(page, '#observations', '11')
    assert.equal(await page.evaluate(() => document.activeElement.id), 'notes')
    await text(page, '#selected', JSON.stringify(selected))
    assert.equal(await page.locator('[data-row="23"]').isChecked(), false)
    assert.equal(await page.locator('[data-row="24"]').isChecked(), false)
    await page.locator('[data-row="23"]').check()
    selected.push(23)
    await text(page, '#selected', JSON.stringify(selected))
    await page.locator('#clear').click()
    await text(page, '#inner', '[]')
    assert.equal(await page.locator('[data-row="23"]').isChecked(), false)
    await page.locator('#toggle').click()
    assert.equal(await page.locator('#list').count(), 0)
    await page.locator('#toggle').click()
    await text(page, '#inner', '[]')
    await page.locator('[data-row="1"]').check()
    await text(page, '#selected', '[1]')
    return { pageMorphs: 11, observerInvocations: 11, settingRespected: true, draftAndFocusPreserved: true, recreatedBindingWorks: true }
  })
  await run(2, async page => {
    let values = [], reads = [], previousMorphs = 0
    for (const count of [0, 1, 5, 10, 20]) {
      await page.evaluate(({ count, previousMorphs }) => {
        let el = document.getElementById('component')
        for (let i = previousMorphs; i < count; i++) Alpine.morph(el, el.outerHTML)
      }, { count, previousMorphs })
      previousMorphs = count
      await page.evaluate(count => {
        window.modelReads = 0
        Alpine.$data(document.getElementById('component')).stored.items.push(count)
      }, count)
      values.push(count)
      await text(page, 'output', JSON.stringify({ items: values }))
      reads.push(await page.evaluate(() => window.modelReads))
    }
    assert(reads[0] > 0)
    assert.deepEqual(reads, Array(5).fill(reads[0]))
    return { totalMorphs: [0, 1, 5, 10, 20], reads }
  })
  for (let old = 0; old < 9; old++) {
    await run(old + 3, async page => {
      await text(page, 'h1', 'foo')
      if ([0, 1, 5, 6, 7].includes(old)) {
        await page.locator('[id="1"]').click()
        await text(page, 'h1', 'bob')
        if (old !== 7) await text(page, 'h2', 'bob')
        await page.locator('[id="2"]').click()
        await text(page, 'h1', 'lob')
        if (old !== 7) await text(page, 'h2', 'lob')
      } else if ([2, 8].includes(old)) {
        await page.locator('button').click()
        await text(page, 'h1', 'foo')
      } else {
        await page.locator('[id="1"]').click()
        await text(page, 'h1', 'bob')
        await page.locator('[id="2"]').click()
        await text(page, 'h2', 'lob')
        assert.equal(await page.locator('h1').textContent(), 'bob')
        if (old === 3) await text(page, 'h1', 'lob')
      }
      return { existingModelableBehavior: true }
    })
  }
  await browser.close()
  fs.writeFileSync(path.join(base, `browser-${mode}.json`), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
  const passes = report.cases.filter(x => x.passed).length
  assert.equal(passes, mode === 'fixed' ? 12 : 9)
  assert(report.cases.every(c => !(c.pageErrors?.length)))
  assert(report.cases.slice(3).every(c => c.passed))
  if (mode !== 'fixed') {
    assert(report.cases[0].error.includes("'1' !== '2'"))
    assert(report.cases[1].error.includes('[99,1,2,3,4]'))
    assert(report.cases[2].error.includes('42'))
  }
})().catch(e => { console.error(e); process.exitCode = 1 })
