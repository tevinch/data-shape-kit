import {expect, test, type Page} from '@playwright/test'

type FixtureEvent = {type: string; operation?: string}
type EffectLifecycle = {setups: number; cleanups: number}

async function events(page: Page): Promise<FixtureEvent[]> {
  return page.evaluate(() => window.dragFixture.getEvents())
}

async function effectLifecycle(page: Page): Promise<EffectLifecycle> {
  return page.evaluate(() => window.dragFixture.getEffectLifecycle())
}

async function startDrag(page: Page, expectedStarts: number) {
  await page.getByRole('row', {name: 'Image 2'}).focus()
  const button = page.getByRole('button', {name: 'Drag Image 2'})
  await button.focus()
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await events(page)).filter((event) => event.type === 'dragstart').length).toBe(expectedStarts)
  await expect(page.locator('[data-drop-target]')).not.toHaveCount(0)
}

test('development StrictMode replays effects and preserves drag cleanup', async ({page}) => {
  await page.goto('/fixture/index.html')

  await expect.poll(() => effectLifecycle(page)).toEqual({setups: 2, cleanups: 1})
  const initialLifecycle = await effectLifecycle(page)
  expect((await events(page)).filter((event) => event.type === 'dragend')).toHaveLength(0)

  await startDrag(page, 1)
  await page.evaluate(() => window.dragFixture.unmountTree())
  await expect(page.getByRole('treegrid', {name: 'Files'})).toHaveCount(0)
  await expect.poll(async () => (await events(page)).filter((event) => event.type === 'dragend').length).toBe(1)
  expect((await events(page)).filter((event) => event.type === 'dragend')).toEqual([
    {type: 'dragend', operation: 'cancel'},
  ])
  await expect(page.locator('[data-drop-target]')).toHaveCount(0)
  await expect(page.locator('[inert]')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY')

  const outside = page.getByRole('textbox', {name: 'Outside editable input'})
  await outside.focus()
  await page.keyboard.type('keyboard works')
  await expect(outside).toHaveValue('keyboard works')

  await page.getByRole('button', {name: 'Mount tree'}).click()
  await expect(page.getByRole('treegrid', {name: 'Files'})).toBeVisible()
  await expect.poll(() => effectLifecycle(page)).toEqual({setups: 4, cleanups: 3})
  const remountedLifecycle = await effectLifecycle(page)
  expect((await events(page)).filter((event) => event.type === 'dragend')).toHaveLength(1)

  await startDrag(page, 2)
  await page.keyboard.press('Escape')
  await expect.poll(async () => (await events(page)).filter((event) => event.type === 'dragend').length).toBe(2)
  expect((await events(page)).filter((event) => event.type === 'dragend')).toEqual([
    {type: 'dragend', operation: 'cancel'},
    {type: 'dragend', operation: 'cancel'},
  ])
  console.log('STRICT_MODE_RESULT', JSON.stringify({
    initial: initialLifecycle,
    remounted: remountedLifecycle,
    dragEnds: (await events(page)).filter((event) => event.type === 'dragend'),
  }))
})
