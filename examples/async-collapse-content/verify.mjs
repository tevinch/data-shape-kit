import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { build, preview } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));
const mode = process.argv[2] ?? 'after';
assert(['before', 'after'].includes(mode), 'Use before or after');
await fs.mkdir(new URL('.checks/', import.meta.url), { recursive: true });
await build({ root, logLevel: 'warn', build: { outDir: 'dist', minify: true } });
const server = await preview({ root, logLevel: 'warn', preview: { host: '127.0.0.1', port: 0 } });
let browser;
const results = [];
const expectedRows = ['Loaded row 1', 'Loaded row 2', 'Loaded row 3', 'Loaded row 4', 'Loaded row 5', 'Loaded row 6', 'Loaded row 7', 'Loaded row 8'];

async function expectRows(page, expected) {
  await page.waitForFunction(want => {
    const actual = [...document.querySelectorAll('#content .n-data-table-td')].map(node => node.textContent);
    return JSON.stringify(actual) === JSON.stringify(want);
  }, { timeout: 5000 }, expected);
  assert.deepEqual(await page.$$eval('#content .n-data-table-td', cells => cells.map(cell => cell.textContent)), expected);
  if (expected.length) {
    await page.waitForFunction(() => {
      const panel = document.querySelector('#content .n-collapse-transition');
      const cells = [...document.querySelectorAll('#content .n-data-table-td')];
      if (!panel || !cells.length) return false;
      const style = getComputedStyle(panel);
      const bounds = panel.getBoundingClientRect();
      return style.display !== 'none' && style.visibility === 'visible' && Number(style.opacity) === 1
        && panel.getAnimations({ subtree: true }).every(animation => animation.playState !== 'running')
        && cells.every(cell => {
          const box = cell.getBoundingClientRect();
          return box.height > 0 && box.top >= bounds.top && box.bottom <= bounds.bottom + 1;
        });
    }, { timeout: 5000 });
  }
}
async function request(page, button, state) {
  await page.click(button);
  await page.waitForFunction(want => document.querySelector('#source-state').textContent === want, {}, state);
}
async function note(page) { return page.$eval('#draft-note', input => input.value); }

try {
  browser = await puppeteer.launch({ headless: true });
  const base = server.resolvedUrls.local[0];
  for (const directive of ['if', 'show']) {
    for (const hidden of [false, true]) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1000, height: 1000 });
      const errors = [];
      let step = 'initial load';
      page.on('pageerror', error => errors.push(String(error)));
      try {
        await page.goto(`${base}?mode=${mode}&directive=${directive}&hidden=${hidden ? 1 : 0}`, { waitUntil: 'networkidle0' });
        if (hidden) {
          assert.equal(await page.$('#content .n-collapse-transition'), null);
          await request(page, '#load', 'loaded: 8 source rows');
          await page.click('#toggle');
        } else {
          await page.type('#draft-note', ' kept');
          await request(page, '#load', 'loaded: 8 source rows');
        }
        await expectRows(page, expectedRows);
        if (hidden) await page.type('#draft-note', ' kept');
        assert.equal(await note(page), 'Draft note kept');
        step = 'replace rows';
        await request(page, '#replace', 'replaced: 2 source rows');
        await expectRows(page, ['Replacement A', 'Replacement B']);
        assert.equal(await note(page), 'Draft note kept', 'data updates must preserve child state');
        step = 'update while collapsed and reopen';
        await page.click('#toggle');
        await page.waitForFunction(kind => {
          const content = document.querySelector('#content .n-collapse-transition');
          return kind === 'if' ? content === null : content && getComputedStyle(content).display === 'none';
        }, {}, directive);
        await request(page, '#load', 'loaded: 8 source rows');
        await page.click('#toggle');
        await expectRows(page, expectedRows);
        assert.equal(await note(page), directive === 'show' ? 'Draft note kept' : 'Draft note');
        step = 'clear and reload';
        const draftBeforeClear = await note(page);
        await request(page, '#clear', 'empty: 0 source rows');
        await expectRows(page, []);
        await page.waitForSelector('#content .n-empty');
        assert.equal(await note(page), draftBeforeClear, 'clearing rows must preserve child state');
        await request(page, '#load', 'loaded: 8 source rows');
        await expectRows(page, expectedRows);
        assert.equal(await note(page), draftBeforeClear, 'reloading rows must preserve child state');
        assert.deepEqual(errors, []);
        await page.screenshot({ path: fileURLToPath(new URL(`.checks/${mode}-${directive}-${hidden}.png`, import.meta.url)), fullPage: true });
        results.push({ mode, directive, initiallyHidden: hidden, passed: true });
      } catch (error) {
        const state = await page.evaluate(() => ({
          source: document.querySelector('#source-state')?.textContent,
          renderedRows: [...document.querySelectorAll('#content .n-data-table-td')].map(cell => cell.textContent),
        })).catch(() => null);
        results.push({ mode, directive, initiallyHidden: hidden, passed: false, step, state, error: String(error), pageErrors: errors });
      } finally { await page.close(); }
    }
  }
  await fs.writeFile(new URL(`.checks/${mode}.json`, import.meta.url), JSON.stringify({ browser: await browser.version(), results }, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
  assert(results.every(result => result.passed), 'The complete async-content workflow must pass');
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
}
