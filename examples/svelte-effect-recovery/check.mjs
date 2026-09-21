import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const label = process.argv[2] || 'original';
const server = http.createServer(async (req,res) => {
  try {
    const name = new URL(req.url,'http://localhost').pathname;
    const file = path.resolve('.verification/dist', '.'+name+(name.endsWith('/')?'index.html':''));
    assert.ok(file.startsWith(path.resolve('.verification/dist')+path.sep));
    res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/html');
    res.end(await fs.readFile(file));
  } catch {res.statusCode=404;res.end('Missing');}
});
await new Promise(r => server.listen(0,'127.0.0.1',r));
let browser;
const results=[];
try {
  browser = await chromium.launch({channel:process.env.CHROME_CHANNEL || undefined,headless:true});
  for(const mode of ['sync-dev','sync-prod','async-dev','async-prod']) {
    const page=await browser.newPage();
    page.setDefaultTimeout(5000);
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const row={label,mode,errors,operations:[]};
    try {
      await page.goto(`http://127.0.0.1:${server.address().port}/${label}-${mode}/`);
      for(let n=0;n<3;n++) {
        await page.locator('[data-toggle]').click();
        await page.waitForFunction(()=>document.querySelector('[data-value]')?.textContent==='x = 1');
        row.operations.push('mount=1');
        await page.locator('[data-increment]').click();
        await page.waitForFunction(()=>document.querySelector('[data-value]')?.textContent==='x = 2');
        row.operations.push('increment=2');
        await page.locator('[data-reset]').click();
        await page.waitForFunction(()=>document.querySelector('[data-value]')?.textContent==='x = 1');
        row.operations.push('reset=1');
        await page.locator('[data-toggle]').click();
        await page.waitForFunction(()=>!document.querySelector('[data-value]'));
        row.operations.push('unmounted');
      }
      row.checks=await page.evaluate(()=>window.checks);
      assert.equal(row.checks.asyncMode,mode.startsWith('async'),'compiler mode must actually activate');
      assert.deepEqual(row.checks.observed,[0,1,2,0,1,0,1,2,0,1,0,1,2,0,1],'self-invalidating effects must settle, including after remounts');
      assert.equal(row.checks.flushes,6,'initialization and resets must each flush');
      assert.deepEqual(errors,[],'normal operations must complete without runtime errors');
      row.passed=true;
    } catch(e) {
      row.passed=false;row.failure=e.message;
      row.checks=await page.evaluate(()=>window.checks).catch(()=>null);
      row.html=await page.locator('#app').innerHTML().catch(()=>null);
    }
    results.push(row);
    await page.close();
  }
} finally {
  try { await browser?.close(); }
  finally { await new Promise(r=>server.close(r)); }
}
await fs.writeFile(`.verification/${label}-results.json`,JSON.stringify(results,null,2)+'\n');
for (const row of results) console.log(`${row.label} ${row.mode}: ${row.passed ? 'passed' : row.failure.split('\n')[0]}`);
if(results.some(r=>!r.passed))process.exitCode=1;
