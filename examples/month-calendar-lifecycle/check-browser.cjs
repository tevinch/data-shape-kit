const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { build } = require('./build.cjs'), { serverFor } = require('./serve.cjs');
const mode = process.argv[2] || 'fixed';
const output = process.env.CHECK_OUTPUT || path.join(__dirname, 'test-results', mode);
const state = page => page.evaluate(() => window.monthCalendar.getState());
const item = async (page, id) => (await state(page)).events.find(e => e.id === id);
async function expectDate(page, id, date) {
  await page.waitForFunction(({ id, date }) => window.monthCalendar.getState().events.some(e => e.id === id && e.start.slice(0, 10) === date), { id, date }, { timeout: 2000 }).catch(async () => assert.equal((await item(page, id))?.start.slice(0, 10), date, `Event ${id} must complete its drop`));
  const cell = await page.locator(`[role="cell"][data-date="${date}"]`).first().boundingBox(), el = await page.locator(`.event-${id}`).first().boundingBox();
  assert(cell && el && el.x >= cell.x - 2 && el.x <= cell.x + 24 && el.y >= cell.y && el.y < cell.y + cell.height, 'Moved event must render in the target date cell');
  const label = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  assert((await page.locator(`#event-list [data-event-id="${id}"]`).innerText()).includes(label), 'Sidebar must show the completed move');
}
async function gesture(page, from, to) {
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(from.x + 12, from.y + 2, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 20 }); await page.mouse.up();
}
async function settled(page, expected = {}) {
  await page.waitForFunction(expected => { const s = monthCalendar.getState(); return (!('width' in expected) || document.querySelector('#calendar-panel').getBoundingClientRect().width === expected.width) && (!('editable' in expected) || s.options.editable === expected.editable) && (!('restricted' in expected) || s.restricted === expected.restricted) && s.options.allowCurrent; }, expected);
  await page.evaluate(() => new Promise(resolve => { let previous = '', stable = 0; function tick() { const value = [...document.querySelectorAll('#calendar-panel [data-date]')].map(e => { const r=e.getBoundingClientRect(); return [r.x,r.y,r.width,r.height]; }).flat().join(','); stable = value === previous ? stable + 1 : 0; previous=value; if(stable>=3)resolve(); else requestAnimationFrame(tick); } requestAnimationFrame(tick); }));
}
async function drag(page, id, date) {
  await settled(page);
  const s = await page.locator(`.event-${id} i`).first().boundingBox(), t = await page.locator(`[role="cell"][data-date="${date}"]`).first().boundingBox();
  assert(s && t, 'Source event and target date must render');
  await gesture(page, { x: s.x + s.width / 2, y: s.y + s.height / 2 }, { x: t.x + t.width / 2, y: t.y + t.height / 2 });
  await page.waitForFunction(() => monthCalendar.getState().counters.dragStop === monthCalendar.getState().counters.dragStart, null, { timeout: 2500 });
}
async function toolbar(page, pattern) {
  const choices = await page.locator('#calendar-panel button').evaluateAll(es => es.map(e => ({ text: e.textContent.trim(), label: e.getAttribute('aria-label') || e.getAttribute('title') || '' })));
  const found = choices.find(e => pattern.test(e.label) || pattern.test(e.text)); assert(found, `Required toolbar action ${pattern} must exist`);
  await page.locator('#calendar-panel button').nth(choices.indexOf(found)).click();
}
const rows = page => page.evaluate(() => ({ deliveries: window.sizeEvidence.deliveries, calls: window.sizeEvidence.calls.filter(e => e.role === 'row'), bodyRows: [...document.querySelectorAll('#calendar-panel [role=rowgroup] > [role=row]')].filter(e => e.querySelector('[data-date][role=cell], [data-date][role=gridcell]')).map(e => ({ height: e.getBoundingClientRect().height, connected: e.isConnected, observed: window.sizeEvidence.active.has(e) })), activeRows: [...window.sizeEvidence.active].filter(e => e.getAttribute('role') === 'row').map(e => ({ height: e.getBoundingClientRect().height, connected: e.isConnected })) }));
(async () => {
  await fs.mkdir(output, { recursive: true }); await build(mode);
  const server = serverFor(mode); await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
  const report = { mode, browser: await browser.version(), verification: 'Software-operated native Chrome, actual pointer input', cases: [] };
  for (const plain of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1100 }, locale: 'en-US', timezoneId: 'Asia/Shanghai' }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      const Native = ResizeObserver, active = new Set(), ids = new WeakMap(); let next = 0;
      window.sizeEvidence = { active, calls: [], deliveries: 0 };
      const describe = el => ({ id: ids.get(el) || (ids.set(el, ++next), next), role: el.getAttribute('role') });
      window.ResizeObserver = class extends Native {
        constructor(cb) { super((entries, observer) => { window.sizeEvidence.deliveries += entries.length; cb(entries, observer); }); }
        observe(el, options) { window.sizeEvidence.calls.push({ type: 'observe', ...describe(el) }); active.add(el); return super.observe(el, options); }
        unobserve(el) { window.sizeEvidence.calls.push({ type: 'unobserve', ...describe(el) }); active.delete(el); return super.unobserve(el); }
        disconnect() { active.clear(); return super.disconnect(); }
      };
    });
    const record = { name: plain ? 'ordinary mounting control' : 'React18 StrictMode complete operation', passed: false, steps: [], checkpoints: [] };
    const step = async (name, fn) => { await fn(); record.steps.push(name); const s=await state(page); const { allowance,...rest }=s; record.checkpoints.push({ name,state:rest,lastAllowance:allowance.at(-1) }); };
    try {
      await page.goto(`http://127.0.0.1:${server.address().port}/${plain ? '?plain' : ''}`); await page.waitForSelector('.event-0 i');
      assert.deepEqual(await page.evaluate(() => ({ version: monthCalendar.reactVersion, development: monthCalendar.development })), { version: '18.3.1', development: true });
      const initial = await state(page); assert.equal(initial.events.length, 2); assert.equal(initial.mounts, plain ? 1 : 2); assert.equal(initial.cleanups, plain ? 0 : 1); record.initial = initial; record.initialRows = await rows(page);

      await step('same-week drop: API, DOM, sidebar and independent callback count', async () => { await drag(page, '0', '2026-10-15'); await expectDate(page, '0', '2026-10-15'); assert.equal((await state(page)).counters.drop, 1); assert.equal(record.initialRows.bodyRows.length, 6); assert(record.initialRows.bodyRows.every(e => e.height > 0 && e.connected && e.observed), 'Every actual body row must have restored measurement'); });
      if (!plain) {
        await step('cross-week and repeated drop', async () => { for (const date of ['2026-10-19', '2026-10-20']) { await drag(page, '0', date); await expectDate(page, '0', date); } assert.equal((await state(page)).counters.drop, 3); });
        await step('native end resize then another completed drop', async () => {
          await page.locator('.event-0').first().hover();
          const candidates = await page.locator('.event-0').first().evaluate(el => [...el.children].map(e => ({ cursor: getComputedStyle(e).cursor, rect: e.getBoundingClientRect().toJSON() })));
          const end = candidates.find(e => /(?:e|ew)-resize/.test(e.cursor)); assert(end && end.rect.width > 0, 'Native end-resize handle must render');
          const t = await page.locator('[role="cell"][data-date="2026-10-22"]').first().boundingBox();
          await gesture(page, { x: end.rect.x + end.rect.width / 2, y: end.rect.y + end.rect.height / 2 }, { x: t.x + t.width / 2, y: end.rect.y + end.rect.height / 2 });
          await page.waitForFunction(() => monthCalendar.getState().events.find(e => e.id === '0').end.slice(0, 10) === '2026-10-23', null, { timeout: 2000 }); assert.equal((await state(page)).counters.resize, 1);
          await drag(page, '0', '2026-10-21'); await expectDate(page, '0', '2026-10-21'); assert.equal((await item(page, '0')).end.slice(0, 10), '2026-10-24');
        });
        await step('navigation and view/weekends/container changes then continued drop', async () => {
          await toolbar(page, /^Next Month$/); await page.waitForFunction(() => monthCalendar.getState().month === 11);
          await toolbar(page, /^Previous Month$/); await page.waitForSelector('.event-0 i');
          await toolbar(page, /^Week view$/); await page.waitForFunction(() => monthCalendar.getState().view === 'timeGridWeek');
          await toolbar(page, /^Month view$/); await page.waitForFunction(() => monthCalendar.getState().view === 'dayGridMonth');
          await page.locator('#weekends').uncheck(); await drag(page, '0', '2026-10-22'); await expectDate(page, '0', '2026-10-22');
          await page.locator('#weekends').check(); await page.locator('#compact').check(); await page.waitForFunction(() => document.querySelector('#calendar-panel').getBoundingClientRect().width === 660);
          await drag(page, '0', '2026-10-23'); await expectDate(page, '0', '2026-10-23'); await page.locator('#compact').uncheck(); await settled(page, { width: 1050 });
        });
        await step('editable/eventAllow limits and a subsequent permitted move', async () => {
          await page.locator('#editable').uncheck(); await settled(page, { editable: false }); const before = await item(page, '0'), drops = (await state(page)).counters.drop;
          await drag(page, '0', '2026-10-19'); assert.deepEqual(await item(page, '0'), before); assert.equal((await state(page)).counters.drop, drops);
          await page.locator('#editable').check(); await page.locator('#restricted').check(); await settled(page, { editable: true, restricted: true }); const allowBefore = (await state(page)).counters.allow;
          await drag(page, '0', '2026-10-20'); assert.deepEqual(await item(page, '0'), before); assert((await state(page)).counters.allow > allowBefore, 'eventAllow must actually run'); assert.equal((await state(page)).counters.drop, drops);
          record.denied = await state(page); assert(record.denied.allowance.slice(allowBefore).some(e=>e.start.slice(0,10)==='2026-10-20' && !e.accepted && e.restricted), 'The attempted blocked date must be rejected'); await page.locator('#restricted').uncheck(); await settled(page, { restricted: false }); await drag(page, '0', '2026-10-20'); await expectDate(page, '0', '2026-10-20'); assert.equal((await state(page)).counters.drop, drops + 1); assert((await state(page)).allowance.slice(allowBefore).some(e=>e.start.slice(0,10)==='2026-10-20' && e.accepted && !e.restricted), 'The restored permission must actually accept the requested move');
        });
        await step('select/add/drag/delete and original content preserved', async () => {
          const s = await page.locator('[role="cell"][data-date="2026-10-26"]').first().boundingBox(), t = await page.locator('[role="cell"][data-date="2026-10-27"]').first().boundingBox(); page.once('dialog', d => d.accept('Release note'));
          await gesture(page, { x: s.x + s.width / 2, y: s.y + s.height / 2 }, { x: t.x + t.width / 2, y: t.y + t.height / 2 }); await page.waitForSelector('.event-2 i');
          assert.equal((await state(page)).events.length, 3); assert.equal((await state(page)).counters.select, 1); assert.equal((await state(page)).counters.added, 1); await expectDate(page, '2', '2026-10-26');
          await drag(page, '2', '2026-10-28'); await expectDate(page, '2', '2026-10-28'); page.once('dialog', d => d.accept()); await page.locator('.event-2 i').first().click();
          await page.waitForFunction(() => monthCalendar.getState().events.length === 2); assert.equal((await state(page)).counters.deleted, 1);
          await drag(page, '0', '2026-10-21'); await expectDate(page, '0', '2026-10-21'); assert.deepEqual(await item(page, '1'), initial.events[1]);
        });
        await step('TimeGrid all-day actual drag, resize and continued month interaction', async () => {
          await toolbar(page, /^Week view$/); await page.waitForFunction(() => monthCalendar.getState().view === 'timeGridWeek'); await toolbar(page, /^Today$/);
          await toolbar(page, /^Next Week$/); await page.waitForSelector('[role="cell"][data-date="2026-10-21"]');
          const before=(await state(page)).counters; await drag(page,'0','2026-10-20'); await expectDate(page,'0','2026-10-20');
          await page.locator('.event-0').first().hover();
          const end=await page.locator('.event-0').first().evaluate(el=>[...el.children].map(e=>({cursor:getComputedStyle(e).cursor,rect:e.getBoundingClientRect().toJSON()})).find(e=>/(?:e|ew)-resize/.test(e.cursor)));
          assert(end && end.rect.width>0); const target=await page.locator('[role="cell"][data-date="2026-10-24"]').first().boundingBox();
          await gesture(page,{x:end.rect.x+end.rect.width/2,y:end.rect.y+end.rect.height/2},{x:target.x+target.width/2,y:end.rect.y+end.rect.height/2});
          await page.waitForFunction(()=>monthCalendar.getState().events.find(e=>e.id==='0').end.slice(0,10)==='2026-10-25');
          assert.equal((await state(page)).counters.resize,before.resize+1); await drag(page,'0','2026-10-21'); await expectDate(page,'0','2026-10-21'); assert.equal((await state(page)).counters.drop,before.drop+2);
          await toolbar(page,/^Month view$/); await page.waitForFunction(()=>monthCalendar.getState().view==='dayGridMonth'); await expectDate(page,'0','2026-10-21');
        });
        await step('dayMaxEvents overflow/popover and synchronous print layout retain content', async () => {
          await page.locator('#crowded-day').click(); await page.waitForFunction(()=>monthCalendar.getState().events.length===16); const before=await state(page);
          const more=page.getByRole('button',{name:/more/i}).filter({hasText:/more/i}).first(); await more.click();
          const popup=page.getByRole('dialog'); await popup.waitFor(); assert((await popup.innerText()).includes('Busy day'), 'Overflow must reveal the hidden content');
          record.overflow={ events:before.events.length, more:await more.innerText(), revealed:await popup.innerText() }; await page.keyboard.press('Escape');
          await page.locator('#print-preview').click(); const printed=await state(page); assert.equal(printed.printBefore,1); assert.equal(printed.printRows.length,6); assert(printed.printRows.every(r=>r.height>0)); assert(printed.printRows.some(r=>r.visibleEvents>=14),'Print layout must synchronously expose crowded-day events'); assert.deepEqual(printed.events,before.events);
          record.print={rows:printed.printRows, eventCount:printed.events.length}; await page.locator('#screen-preview').click(); await page.waitForFunction(()=>monthCalendar.getState().printAfter===1);
          await page.locator('#crowded-day').click(); await page.waitForFunction(()=>monthCalendar.getState().events.length===2); await drag(page,'0','2026-10-22'); await expectDate(page,'0','2026-10-22'); assert.deepEqual(await item(page,'1'),initial.events[1]);
        });
        await step('true unmount cleanup and a fresh usable mount', async () => {
          await page.locator('#toggle-calendar').click(); await page.waitForSelector('.event-0', { state: 'detached' }); assert.equal((await rows(page)).activeRows.length, 0);
          await page.locator('#toggle-calendar').click(); await page.waitForSelector('.event-0 i'); await drag(page, '0', '2026-10-15'); await expectDate(page, '0', '2026-10-15');
        });
      }
      assert.deepEqual(errors, []); record.passed = true;
    } catch (e) { record.error = e.message; }
    finally { record.errors = errors; record.final = await state(page).catch(() => null); record.finalRows = await rows(page).catch(() => null);
      if (record.finalRows) { const activeIds = new Set(); record.duplicateRowObservations = []; for (const call of record.finalRows.calls) { if (call.type === 'observe') { if (activeIds.has(call.id)) record.duplicateRowObservations.push(call.id); activeIds.add(call.id); } else activeIds.delete(call.id); } if (record.duplicateRowObservations.length) { record.passed = false; record.error = 'A row was observed twice without disconnecting'; } }
      await page.screenshot({ path: path.join(output, plain ? 'plain.png' : 'strict.png') }); await fs.writeFile(path.join(output, plain ? 'plain-state.html' : 'strict-state.html'), await page.content()); report.cases.push(record); await page.close(); }
  }
  await browser.close(); await new Promise(r => server.close(r)); await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report.cases.map(c => ({ name: c.name, passed: c.passed, steps: c.steps, error: c.error, pageErrors: c.errors })))); assert(report.cases.every(c => c.passed), 'Calendar operation checks failed');
})().catch(e => { console.error(e.message); process.exitCode = 1; });
