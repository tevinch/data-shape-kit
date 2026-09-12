import {expect, test, type Page} from '@playwright/test'

type FixtureEvent = {type: string; operation?: string}

async function events(page: Page): Promise<FixtureEvent[]> {
  return page.evaluate(() => window.dragFixture.getEvents())
}

async function startDrag(page: Page, label: string, expectedStarts = 1) {
  await page.getByRole('row', {name: label}).focus()
  const button = page.getByRole('button', {name: `Drag ${label}`})
  await button.focus()
  await expect(button).toBeFocused()
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await events(page)).filter((event) => event.type === 'dragstart').length).toBe(expectedStarts)
  await expect(page.locator('[data-drop-target]')).not.toHaveCount(0)
}

async function moveToExpandedBranchTarget(page: Page, label: string) {
  for (let index = 0; index < 12; index += 1) {
    const activeTarget = await page.evaluate(() => ({
      label: document.activeElement?.getAttribute('aria-label'),
      expanded: document.activeElement?.closest('[role="row"]')?.getAttribute('aria-expanded'),
    }))
    if (activeTarget.label?.endsWith(label) && activeTarget.expanded === 'true') {
      return
    }
    await page.keyboard.press('ArrowUp')
  }
  throw new Error(`Could not reach the on-target for ${label}`)
}

async function expectCleanCancellation(page: Page, expectedCount = 1) {
  await expect.poll(async () => (await events(page)).filter((event) => event.type === 'dragend').length).toBe(expectedCount)
  const endEvents = (await events(page)).filter((event) => event.type === 'dragend')
  expect.soft(endEvents.at(-1)?.operation).toBe('cancel')
  expect.soft(await page.locator('[data-drop-target]').count()).toBe(0)
  const inertCount = await page.locator('[inert]').count()
  expect.soft(inertCount).toBe(0)
  await expect.soft.poll(() => page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY')
  const focus = await page.evaluate(() => ({
    connected: document.activeElement?.isConnected,
    tag: document.activeElement?.tagName,
    label: document.activeElement?.getAttribute('aria-label'),
  }))
  expect.soft(focus.connected).toBe(true)
  expect.soft(focus.tag).not.toBe('BODY')

  const outside = page.getByRole('textbox', {name: 'Outside editable input'})
  await outside.focus()
  await page.keyboard.type('keyboard works')
  const outsideValue = await outside.inputValue()
  expect.soft(outsideValue).toBe('keyboard works')
  expect.soft(await outside.getAttribute('aria-hidden')).not.toBe('true')
  return {focus, inertCount, outsideValue}
}

for (const direction of ['ltr', 'rtl'] as const) {
  test(`source ancestor collapse cancels once and restores keyboard use (${direction.toUpperCase()})`, async ({page}) => {
    await page.goto(`/fixture/index.html?dir=${direction}`)
    await startDrag(page, 'Image 2')
    await moveToExpandedBranchTarget(page, 'Photos')
    await page.keyboard.press(direction === 'ltr' ? 'ArrowLeft' : 'ArrowRight')
    await expect(page.getByRole('button', {name: 'Drag Image 2'})).toHaveCount(0)
    const cleanup = await expectCleanCancellation(page)

    await page.keyboard.press('Escape')
    const dragEndCount = (await events(page)).filter((event) => event.type === 'dragend').length
    if (Reflect.get(globalThis, 'process')?.env?.REPRODUCE_MODE === '1') {
      console.log('REPRO_SNAPSHOT', JSON.stringify({
        inertCount: cleanup.inertCount,
        focusTag: cleanup.focus.tag,
        outsideValue: cleanup.outsideValue,
        dragEndCount,
      }))
    }
    expect(dragEndCount).toBe(1)
  })
}

test('removing the source through application data cancels once', async ({page}) => {
  await page.goto('/fixture/index.html')
  await startDrag(page, 'Image 2')
  await page.evaluate(() => window.dragFixture.removeSource())
  await expect(page.getByRole('button', {name: 'Drag Image 2'})).toHaveCount(0)
  await expectCleanCancellation(page)
})

test('collapsing an unrelated branch leaves the drag usable', async ({page}) => {
  await page.goto('/fixture/index.html')
  await startDrag(page, 'Budget')
  await moveToExpandedBranchTarget(page, 'Photos')
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByRole('button', {name: 'Drag Image 2'})).toHaveCount(0)
  await expect(page.locator('[data-drop-target]')).not.toHaveCount(0)
  await page.keyboard.press('Escape')
  await expectCleanCancellation(page)
})

test('unmounting the whole widget cancels once and focuses outside it', async ({page}) => {
  await page.goto('/fixture/index.html')
  await startDrag(page, 'Image 2')
  await page.evaluate(() => window.dragFixture.unmountTree())
  await expect(page.getByRole('treegrid', {name: 'Files'})).toHaveCount(0)
  await expectCleanCancellation(page)
})

test('normal Escape cancels once and returns focus to the source', async ({page}) => {
  await page.goto('/fixture/index.html')
  await startDrag(page, 'Image 2')
  await page.keyboard.press('Escape')
  const cleanup = await expectCleanCancellation(page)
  expect(cleanup.focus.label).toBe('Drag Image 2')
})

test('a successful move that synchronously removes its source ends once as move', async ({page}) => {
  await page.goto('/fixture/index.html')
  await page.getByLabel('Remove the source synchronously during a successful move').check()
  await startDrag(page, 'Image 2')
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await events(page)).some((event) => event.type === 'move')).toBe(true)
  await expect(page.getByRole('button', {name: 'Drag Image 2'})).toHaveCount(0)
  const endEvents = (await events(page)).filter((event) => event.type === 'dragend')
  expect(endEvents).toEqual([{type: 'dragend', operation: 'move'}])
  await expect(page.locator('[data-drop-target]')).toHaveCount(0)
  await page.getByRole('textbox', {name: 'Outside editable input'}).focus()
  await page.keyboard.type('keyboard works')
  await expect(page.getByRole('textbox', {name: 'Outside editable input'})).toHaveValue('keyboard works')
})

test('a new drag starts after source-unmount cancellation', async ({page}) => {
  await page.goto('/fixture/index.html')
  await startDrag(page, 'Image 2')
  await moveToExpandedBranchTarget(page, 'Photos')
  await page.keyboard.press('ArrowLeft')
  await expect.poll(async () => (await events(page)).filter((event) => event.type === 'dragend').length).toBe(1)

  await page.getByRole('button', {name: 'Toggle Photos'}).click()
  await startDrag(page, 'Image 2', 2)
  await page.keyboard.press('Escape')
  const endEvents = (await events(page)).filter((event) => event.type === 'dragend')
  expect(endEvents).toEqual([
    {type: 'dragend', operation: 'cancel'},
    {type: 'dragend', operation: 'cancel'},
  ])
})

test('tree mount cycles without a drag do not emit drag-end', async ({page}) => {
  await page.goto('/fixture/index.html')
  await page.getByRole('button', {name: 'Unmount tree'}).click()
  await expect(page.getByRole('treegrid', {name: 'Files'})).toHaveCount(0)
  await page.getByRole('button', {name: 'Mount tree'}).click()
  await expect(page.getByRole('treegrid', {name: 'Files'})).toBeVisible()
  expect((await events(page)).filter((event) => event.type === 'dragend')).toHaveLength(0)
  const outside = page.getByRole('textbox', {name: 'Outside editable input'})
  await outside.fill('keyboard works')
  await expect(outside).toHaveValue('keyboard works')
})
