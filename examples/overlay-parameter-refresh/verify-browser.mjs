import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import puppeteer from 'puppeteer';

const base = process.env.CHECK_URL || 'http://127.0.0.1:4173';
const output = process.env.CHECK_OUTPUT || 'checks';
const original = process.argv.includes('--original');
const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, headless: true });
const results = [];
const expectedRows = [{ name: 'Apricot', quantity: 12 }, { name: 'Pear', quantity: 7 }];
await mkdir(output, { recursive: true });

async function visible(page, selector) {
  await page.waitForSelector(selector, { visible: true });
  return page.$eval(selector, element => {
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && box.top >= 0 && box.bottom <= innerHeight;
  });
}
async function revision(page, wanted) {
  await page.waitForFunction(value => document.querySelector('#requested')?.textContent === String(value), {}, wanted);
  // Allow React's scheduled wrapper refresh to settle before asserting its rendered result.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.$eval('[data-label]', element => element.textContent), `Revision ${wanted}`, 'visible overlay label must follow updated params');
}
async function checkRows(page) {
  await page.waitForFunction(() => window.readGrid().displayed.length === 2 && !document.querySelector('.custom-overlay'));
  const state = await page.evaluate(() => window.readGrid());
  assert.deepEqual(state, { all: expectedRows, displayed: expectedRows, filters: {}, loading: false });
  await page.waitForFunction(() => document.querySelectorAll('.ag-grid-scrolling-container .ag-row').length === 2);
  const rendered = await page.$$eval('.ag-grid-scrolling-container .ag-row', elements => elements.map(element => [...element.querySelectorAll('.ag-cell')].map(cell => cell.textContent)));
  assert.deepEqual(rendered, [['Apricot', '12'], ['Pear', '7']]);
}
async function scenario(mode, flow) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1120, height: 980 });
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  try {
    await page.goto(`${base}/?mode=${mode}`, { waitUntil: 'networkidle0' });
    assert.ok(await visible(page, '[data-label]'));
    await revision(page, 1);
    if (flow === 'noRows') {
      await page.type('[data-note]', 'keep this unfinished note');
      await page.click('#update'); await revision(page, 2);
      await page.click('#update'); await revision(page, 3);
      assert.equal(await page.$eval('[data-note]', element => element.value), 'keep this unfinished note');
      await page.click('#action-toggle');
      assert.ok(await visible(page, '[data-action]'));
      await page.click('[data-action]');
      await page.waitForFunction(() => document.querySelector('#callback').textContent === '3');
      await page.click('#action-toggle');
      await page.waitForSelector('[data-action]', { hidden: true });
      await page.click('#loading');
      if (mode === 'direct') await page.waitForSelector('.custom-overlay[data-type="loading"]');
      else {
        await page.waitForSelector('.ag-overlay-loading-center', { visible: true });
        await page.waitForSelector('.custom-overlay', { hidden: true });
      }
      assert.equal((await page.evaluate(() => window.readGrid())).loading, true);
      await page.click('#loading');
      await page.waitForSelector('.custom-overlay[data-type="noRows"]', { visible: true });
      await page.click('#load'); await checkRows(page);
      await page.click('#empty');
      assert.ok(await visible(page, '.custom-overlay[data-type="noRows"]'));
      await page.click('#update'); await revision(page, 4);
    } else {
      await page.click('#load'); await checkRows(page);
      for (let cycle = 1; cycle <= 2; cycle++) {
        await page.click('#filter');
        assert.ok(await visible(page, '.custom-overlay[data-type="noMatchingRows"]'));
        const filtered = await page.evaluate(() => window.readGrid());
        assert.deepEqual(filtered.all, expectedRows);
        assert.deepEqual(filtered.displayed, []);
        assert.equal(filtered.filters.name.filter, 'Plum');
        await page.type('[data-note]', `draft ${cycle}`);
        await page.click('#update'); await revision(page, cycle * 2);
        await page.click('#action-toggle');
        assert.ok(await visible(page, '[data-action]'));
        // Change the callback again while the same button remains on screen.
        await page.click('#update'); await revision(page, cycle * 2 + 1);
        assert.equal(await page.$eval('[data-note]', element => element.value), `draft ${cycle}`);
        await page.screenshot({ path: `${output}/${mode}-${flow}-${cycle}.png` });
        await page.click('[data-action]');
        await page.waitForFunction(value => document.querySelector('#callback').textContent === String(value), {}, cycle * 2 + 1);
        await checkRows(page);
        await page.click('#action-toggle');
      }
    }
    assert.deepEqual(errors, [], 'no browser runtime errors');
    results.push({ mode, flow, passed: true });
  } catch (error) {
    results.push({ mode, flow, passed: false, message: error.message, errors });
    await page.screenshot({ path: `${output}/${mode}-${flow}-failure.png` });
  } finally { await page.close(); }
}
try {
  for (const mode of ['selector', 'direct']) {
    await scenario(mode, 'noRows');
    await scenario(mode, 'noMatchingRows');
  }
  await scenario('legacy', 'noRows');
  const report = { original, browser: await browser.version(), results };
  await writeFile(`${output}/results.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (original) {
    assert.equal(results.filter(item => !item.passed).length, 4);
    assert.ok(results.filter(item => !item.passed).every(item => item.mode !== 'legacy' && item.message.includes('visible overlay label must follow updated params') && item.errors.length === 0));
    assert.equal(results.find(item => item.mode === 'legacy').passed, true);
  } else assert.ok(results.every(item => item.passed), 'every original workflow must pass');
} finally { await browser.close(); }
