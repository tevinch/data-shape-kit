import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';

const reproduction = process.env.REPRODUCE_ORIGINAL === '1';
let browser;
let origin;
let server;

before(async () => {
  server = spawn(process.execPath, ['server.mjs'], { cwd: new URL('..', import.meta.url), stdio: ['ignore', 'pipe', 'pipe'] });
  const chunks = [];
  server.stderr.on('data', (chunk) => chunks.push(chunk));
  const [chunk] = await once(server.stdout, 'data');
  const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/);
  assert.ok(match, `server did not print its URL: ${Buffer.concat(chunks).toString()}`);
  origin = match[0];
  browser = await chromium.launch({ channel: 'chrome', headless: true });
});

after(async () => {
  await browser?.close();
  server?.kill('SIGTERM');
  if (server && server.exitCode === null) await once(server, 'exit');
});

async function readState(page) {
  return page.evaluate(() => {
    const label = document.querySelector('[data-slot-time]');
    const labels = [...document.querySelectorAll('[data-slot-time]')];
    const booking = document.querySelector('.calendar-booking');
    const event = window.calendar.getEventById('booking');
    const labelRect = label?.getBoundingClientRect();
    const bookingRect = booking?.getBoundingClientRect();
    return {
      firstSlotTime: label?.dataset.slotTime ?? null,
      lastSlotTime: labels.at(-1)?.dataset.slotTime ?? null,
      firstSlotText: label?.textContent.trim() ?? null,
      labelWidth: labelRect?.width ?? 0,
      slotHeight: labelRect?.height ?? 0,
      bookingWidth: bookingRect?.width ?? 0,
      bookingHeight: bookingRect?.height ?? 0,
      view: window.calendar.view.type,
      date: window.calendar.getDate().toISOString(),
      event: event && {
        id: event.id,
        title: event.title,
        start: event.start.toISOString(),
        end: event.end.toISOString(),
        resourceIds: event.getResources().map((resource) => resource.id),
      },
    };
  });
}

async function setOpeningTime(page, min) {
  await page.selectOption('#opening-time', min);
  await page.evaluate((value) => window.calendar.setOption('slotMinTime', value), min);
  await waitForSettledLayout(page, min, { expectCollapse: reproduction });
}

async function setClosingTime(page, max) {
  await page.selectOption('#closing-time', max);
  await page.evaluate((value) => window.calendar.setOption('slotMaxTime', value), max);
  const [hours, minutes] = max.split(':').map(Number);
  const finalMinutes = hours * 60 + minutes - 15;
  const expectedLast = `${String(Math.floor(finalMinutes / 60)).padStart(2, '0')}:${String(finalMinutes % 60).padStart(2, '0')}`;
  await page.waitForFunction(
    (expected) => [...document.querySelectorAll('[data-slot-time]')].at(-1)?.dataset.slotTime === expected,
    expectedLast,
    { timeout: 4_000 },
  );
}

async function waitForSettledLayout(page, expectedTime, { expectCollapse = false } = {}) {
  await page.evaluate(
    ({ expectedTime, expectCollapse }) => new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        const label = document.querySelector('[data-slot-time]');
        const rect = label?.getBoundingClientRect();
        const observed = label
          ? `${label.dataset.slotTime}, ${rect.width}px wide, ${rect.height}px high`
          : 'no labelled slot';
        reject(new Error(expectCollapse
          ? `Original configuration did not reach the defining 0-width collapse within 4000ms; last observed ${observed}`
          : `Configured layout did not settle with usable dimensions within 4000ms; last observed ${observed}`));
      }, 4_000);
      let previous;
      let stableFrames = 0;
      let observedFrames = 0;

      const sample = () => {
        observedFrames += 1;
        const label = document.querySelector('[data-slot-time]');
        const rect = label?.getBoundingClientRect();
        const current = label && {
          time: label.dataset.slotTime,
          width: rect.width,
          height: rect.height,
        };
        stableFrames = current
          && previous
          && current.time === previous.time
          && current.width === previous.width
          && current.height === previous.height
          ? stableFrames + 1
          : 1;
        previous = current;

        const isExpectedState = current?.time === expectedTime
          && (expectCollapse
            ? current.width === 0 && current.height < 40
            : current.width > 0 && current.height >= 40);
        if (observedFrames >= 4 && stableFrames >= 3 && isExpectedState) {
          window.clearTimeout(timeout);
          resolve({ ...current, observedFrames, stableFrames });
          return;
        }
        requestAnimationFrame(sample);
      };

      requestAnimationFrame(sample);
    }),
    { expectedTime, expectCollapse },
  );
}

function assertUsableState(state, baseline, expectedMin) {
  assert.equal(state.firstSlotTime, expectedMin);
  assert.match(state.firstSlotText, new RegExp(String(Number(expectedMin.slice(0, 2)))));
  assert.ok(state.labelWidth > 0, `expected a positive label width, got ${state.labelWidth}`);
  assert.ok(state.slotHeight >= 40, `expected a slot height of at least 40px, got ${state.slotHeight}`);
  assert.ok(state.bookingWidth > 0 && state.bookingHeight > 0, `expected a visible booking, got ${state.bookingWidth}x${state.bookingHeight}`);
  assert.equal(state.view, baseline.view);
  assert.equal(state.date, baseline.date);
  assert.deepEqual(state.event, baseline.event);
}

async function verifyView(resourceMode) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const query = new URLSearchParams();
  if (resourceMode) query.set('resource', '1');
  if (reproduction) query.set('original', '1');
  await page.goto(`${origin}/?${query}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.calendar && document.querySelector('[data-slot-time]'));

  const baseline = await readState(page);
  assert.equal(baseline.firstSlotTime, '05:45');
  assert.equal(baseline.view, resourceMode ? 'resourceTimeGridDay' : 'timeGridDay');
  assert.equal(baseline.date, '2026-09-12T00:00:00.000Z');
  assert.deepEqual(baseline.event, {
    id: 'booking',
    title: 'Example booking',
    start: '2026-09-12T10:00:00.000Z',
    end: '2026-09-12T11:00:00.000Z',
    resourceIds: ['one'],
  });

  const openingTimes = reproduction ? ['08:00'] : ['06:00', '08:00', '04:30', '08:00'];
  for (const openingTime of openingTimes) {
    await setOpeningTime(page, openingTime);
    const state = await readState(page);
    if (openingTime === '08:00' && process.env.SCREENSHOT_DIR) {
      await mkdir(process.env.SCREENSHOT_DIR, { recursive: true });
      const name = `${resourceMode ? 'resource' : 'standard'}-${reproduction ? 'original' : 'configured'}.png`;
      await page.screenshot({ path: join(process.env.SCREENSHOT_DIR, name), fullPage: true });
    }
    assert.deepEqual(errors, [], 'browser errors must be absent before checking layout');
    if (reproduction) {
      console.log(`Original configuration at ${state.firstSlotTime}: label ${state.labelWidth}px wide, slot ${state.slotHeight}px high`);
    }
    assertUsableState(state, baseline, openingTime);
  }

  if (!reproduction) {
    await setClosingTime(page, '18:00');
    const afterClosingChange = await readState(page);
    assert.equal(afterClosingChange.lastSlotTime, '17:45');
    assertUsableState(afterClosingChange, baseline, '08:00');
  }

  assert.deepEqual(errors, []);
  await page.close();
}

test(reproduction ? 'original configuration reproduces collapsed layout' : 'configured standard view retains layout after changing opening time', async () => {
  await verifyView(false);
});

if (!reproduction) {
  test('configured resource view retains layout after changing opening time', async () => {
    await verifyView(true);
  });
}
