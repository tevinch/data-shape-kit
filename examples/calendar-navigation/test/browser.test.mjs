import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openExample } from './support.mjs';

test('Spanish 12-month navigation, Today, and month switching preserve the view configuration and event', async t => {
  const { page, errors, browserVersion } = await openExample(t);
  assert.deepEqual(errors, [], 'the initial view must render without the reported exception');
  const instance = await page.evaluateHandle(() => window.calendar);
  let states = 0;
  async function check(start, end, title, view = 'dayGridYear') {
    await page.waitForFunction(({ start, end, view }) => {
      const current = window.calendar.view;
      return current.type === view && current.currentStart.toISOString().slice(0, 10) === start
        && current.currentEnd.toISOString().slice(0, 10) === end;
    }, { start, end, view }, { timeout: 4000 });
    const [monthPrefix, year] = title.split(' ');
    // Spanish range titles abbreviate months; monthly titles use the full name.
    const headingPattern = new RegExp(`\\b${monthPrefix}[a-z.]*\\s+(?:de\\s+)?${year}\\b`, 'i');
    await page.getByRole('heading', { level: 2 }).filter({ hasText: headingPattern }).waitFor({ timeout: 4000 });
    const state = await page.evaluate(original => {
      const calendar = window.calendar;
      const event = calendar.getEventById('meeting');
      return {
        duration: calendar.getOption('views').dayGridYear.duration,
        locale: calendar.getOption('locale'),
        event: event && { id: event.id, title: event.title, start: event.start.toISOString().slice(0, 10), reference: event.extendedProps.reference },
        eventCount: calendar.getEvents().length,
        rendered: window.renderFinished === true,
        period: document.querySelector('#period').textContent,
        sameInstance: calendar === original,
      };
    }, instance);
    assert.deepEqual(errors, [], 'calendar must not emit runtime errors');
    assert.equal(state.rendered, true);
    assert.equal(state.sameInstance, true, 'keep the same Calendar instance');
    assert.equal(state.locale, 'es');
    assert.deepEqual(state.duration, { month: 12 }, 'preserve the original custom duration');
    assert.equal(state.eventCount, 1);
    assert.deepEqual(state.event, { id: 'meeting', title: 'Reunión de ejemplo', start: '2024-07-16', reference: 'unchanged' });
    assert.ok(state.period.includes(`${start} → ${end}`));
    for (const hint of ['Periodo anterior', 'Ir a hoy', 'Periodo siguiente']) {
      const control = page.getByRole('button', { name: hint, exact: true });
      assert.equal(await control.count(), 1);
      assert.equal(await control.isVisible(), true);
      const attrs = await control.evaluate(el => ({ title: el.getAttribute('title'), aria: el.getAttribute('aria-label') }));
      assert.ok(attrs.title === hint || attrs.aria === hint, 'hint must be exposed to the browser');
    }
    states++;
  }
  const click = name => page.getByRole('button', { name, exact: true }).click();
  await check('2024-07-01', '2025-07-01', 'jul 2024');
  assert.equal(await page.getByText('Reunión de ejemplo', { exact: true }).isVisible(), true);
  for (let repeat = 0; repeat < 2; repeat++) {
    await click('Periodo siguiente');
    await check('2025-07-01', '2026-07-01', 'jul 2025');
    await click('Periodo anterior');
    await check('2024-07-01', '2025-07-01', 'jul 2024');
    assert.equal(await page.getByText('Reunión de ejemplo', { exact: true }).isVisible(), true);
  }
  await click('Ir a hoy');
  await check('2026-09-01', '2027-09-01', 'sep 2026');
  await page.getByRole('tab', { name: 'Vista del mes', exact: true }).click();
  await check('2026-09-01', '2026-10-01', 'sep 2026', 'dayGridMonth');
  await click('Periodo siguiente');
  await check('2026-10-01', '2026-11-01', 'oct 2026', 'dayGridMonth');
  await click('Periodo anterior');
  await check('2026-09-01', '2026-10-01', 'sep 2026', 'dayGridMonth');
  await page.getByRole('tab', { name: 'Vista del 12 meses', exact: true }).click();
  await check('2026-09-01', '2027-09-01', 'sep 2026');
  await click('Periodo siguiente');
  await check('2027-09-01', '2028-09-01', 'sep 2027');
  await click('Ir a hoy');
  await check('2026-09-01', '2027-09-01', 'sep 2026');
  assert.equal(states, 12);
  t.diagnostic(`FullCalendar 7.1.0; Chrome ${browserVersion}; ${states} verified states; no runtime errors`);
});
