import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { startServer } from '../server.mjs';

test('raster exports finish, release their workers and remain usable after errors', { timeout: 120000 }, async () => {
  const server = await startServer({ checks: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const page = await browser.newPage();
    const workers = new Set(); let created = 0; let closed = 0;
    page.on('worker', worker => {
      created++; workers.add(worker);
      worker.on('close', () => { closed++; workers.delete(worker); });
    });
    await page.goto(server.url + '/checks');
    await page.waitForFunction(() => window.checks);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    const heap = async (session = cdp) => {
      await session.send('HeapProfiler.collectGarbage');
      return (await session.send('Performance.getMetrics')).metrics.find(x => x.name === 'JSHeapUsedSize').value;
    };
    await page.evaluate(() => window.checks.warmup());
    const baseline = await heap();
    const reports = [];
    await mkdir('.checks', { recursive: true });
    for (const scenario of [
      { pages: 5, format: 'JPEG', encrypted: false },
      { pages: 5, format: 'JPEG', encrypted: true },
      { pages: 10, format: 'JPEG', encrypted: true },
      { pages: 1, format: 'PNG', encrypted: true },
      { pages: 2, format: 'JPEG', encrypted: true, byteArray: true, landscape: true },
    ]) {
      const control = await browser.newPage();
      await control.goto(server.url + '/control');
      await control.waitForFunction(() => window.control);
      const controlCDP = await control.context().newCDPSession(control);
      await controlCDP.send('Performance.enable');
      const controlBaseline = await heap(controlCDP);
      const direct = await control.evaluate(s => window.control.exportOne(s), scenario);
      const directRetainedHeap = (await heap(controlCDP)) - controlBaseline;
      if (scenario.encrypted && scenario.pages >= 5) assert.ok(directRetainedHeap > 8 * 1024 * 1024, 'The direct control must reproduce retention');
      await control.close();
      const result = await page.evaluate(s => window.checks.exportOne(s), scenario);
      assert.equal(result.inputPreserved, true);
      assert.equal(result.workerHeader, '%PDF-1.3');
      // Random PDF IDs can change escaped ciphertext lengths. Compare decoded
      // page streams and image data with verify-pdfs.py, not whole-file sizes.
      assert.ok(result.workerBytes > 1000);
      const label = `${scenario.pages}-${scenario.format}-${scenario.encrypted}-${!!scenario.byteArray}`;
      for (const mode of ['direct', 'worker']) {
        await writeFile(`.checks/${label}-${mode}.pdf`, Buffer.from(mode === 'direct' ? direct.base64 : result.base64, 'base64'));
      }
      await page.waitForTimeout(50);
      assert.equal(workers.size, 0, 'Every completed export must close its worker');
      reports.push({ ...scenario, label, bytes: result.workerBytes, directRetainedHeap, retainedHeap: (await heap()) - baseline });
    }
    const sequence = await page.evaluate(() => window.checks.retryAndParallel());
    assert.deepEqual(sequence, { invalidImage: true, cancelled: true, customCancellation: true, timeout: true, cloneError: true, retry: true, parallel: true, inputPreserved: true });
    await page.waitForTimeout(100);
    assert.equal(workers.size, 0);
    assert.equal(created, closed);
    assert.ok(created >= 9, 'The successful worker path must actually execute');
    const browserCDP = await browser.newBrowserCDPSession();
    assert.equal((await browserCDP.send('Target.getTargets')).targetInfos.filter(t => t.type === 'worker').length, 0);
    const retainedHeap = (await heap()) - baseline;
    assert.ok(retainedHeap < 8 * 1024 * 1024, `Parent heap retained ${retainedHeap} bytes after outputs were released`);
    await page.goto(server.url);
    await page.getByRole('button', { name: 'Export 5 pages' }).click();
    await page.getByRole('link', { name: 'Download PDF' }).waitFor({ state: 'visible' });
    const oldURL = await page.getByRole('link', { name: 'Download PDF' }).getAttribute('href');
    await page.getByLabel('Use the sample document password').check();
    await page.getByRole('button', { name: 'Export 5 pages' }).click();
    await page.getByRole('link', { name: 'Download PDF' }).waitFor({ state: 'visible' });
    assert.match(await page.getByRole('status').innerText(), /Five-page PDF ready/);
    assert.equal(await page.evaluate(async old => { try { await fetch(old); return false; } catch { return true; } }, oldURL), true, 'The previous download URL must be released');
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Download PDF' }).click();
    await (await downloadEvent).saveAs('.checks/demo-protected.pdf');
    await page.waitForTimeout(50);
    assert.equal(workers.size, 0);
    assert.equal(created, closed);
    const report = { chrome: browser.version(), node: process.version, created, closed, retainedHeap, reports };
    await writeFile('.checks/report.json', JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  } finally { await browser.close(); await server.close(); }
});
