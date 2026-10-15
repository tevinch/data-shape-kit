import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startServer } from './server.mjs';

const baseline = process.argv.includes('--baseline');
const server = await startServer();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const page = await browser.newPage({ deviceScaleFactor: 1 });
const externalRequests = [];
await page.route('**/*', (route) => {
  const url = new URL(route.request().url());
  if (url.origin === server.url) return route.continue();
  externalRequests.push(url.href);
  return route.abort();
});

const results = [];
try {
  await page.goto(`${server.url}/test.html`);
  await page.evaluate(async ({ baseline }) => {
    const fabric = await import('./node_modules/fabric/dist/index.mjs');
    const recipe = baseline ? null : await import('./load-document.js');
    window.fixture = { fabric, recipe, baseline };
  }, { baseline });

  // Catches a missing finally, unconditional true, or failure-only rendering repair.
  for (const automatic of [true, false]) {
    for (const failure of ['unknown', 'missing', 'cancel']) {
      const name = `renderOnAddRemove=${automatic}: ${failure}, preserve, edit, retry`;
      try {
        const result = await page.evaluate(async ({ automatic, failure }) => {
          const { fabric, recipe, baseline } = window.fixture;
          const element = document.createElement('canvas');
          document.body.append(element);
          const canvas = new fabric.StaticCanvas(element, {
            width: 160, height: 100, enableRetinaScaling: false,
            backgroundColor: '#ffffff', renderOnAddRemove: automatic,
          });
          const frames = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const pixel = (x, y) => [...canvas.getContext().getImageData(x, y, 1, 1).data];
          const check = (condition, message) => { if (!condition) throw new Error(message); };
          const old = new fabric.Rect({ left: 10, top: 10, width: 24, height: 24, fill: '#ff0000', strokeWidth: 0 });
          canvas.add(old);
          canvas.requestRenderAll();
          await frames();
          check(JSON.stringify(pixel(20, 20)) === '[255,0,0,255]', 'Initial document is visible');
          const before = JSON.stringify(old.toObject());
          const id = `${automatic}-${failure}-${Date.now()}`;
          const controller = new AbortController();
          const image = { type: 'Image', src: `/missing.png?id=${id}`, width: 20, height: 20 };
          const json = failure === 'unknown'
            ? { background: '#000000', objects: [{ type: 'NotRegistered' }] }
            : { background: '#000000', objects: [{ ...image, src: `/${failure === 'cancel' ? 'pending' : 'missing'}.png?id=${id}` }] };
          const run = async (json, signal) => {
            if (!baseline) return recipe.loadDocument(canvas, json, signal);
            try {
              await canvas.loadFromJSON(json, (_serialized, _instance, error) => { if (error) throw error; }, { signal });
              canvas.requestRenderAll();
              return { status: 'loaded' };
            } catch (error) {
              return { status: signal?.aborted ? 'cancelled' : 'failed', error };
            }
          };
          let settled = false;
          const loading = run(json, controller.signal).finally(() => { settled = true; });
          let requestStarted = false;
          if (failure === 'cancel') {
            for (let attempts = 0; attempts < 100; attempts++) {
              const stats = await fetch(`/stats?id=${id}`).then((r) => r.json());
              if (stats.requests === 1 && stats.pending === 1) { requestStarted = true; break; }
              await new Promise((resolve) => setTimeout(resolve, 10));
            }
            check(requestStarted, 'Server saw in-flight image before abort');
            check(!settled, 'Load is genuinely pending before abort');
            controller.abort();
          }
          const outcome = await loading;
          check(outcome.status === (failure === 'cancel' ? 'cancelled' : 'failed'), `Expected rejection/cancellation, got ${outcome.status}`);
          if (failure === 'missing') check(outcome.error?.message.includes(`/missing.png?id=${id}`), 'Strict rejection contains the actual failed image URL');
          const stats = await fetch(`/stats?id=${id}`).then((r) => r.json());
          if (failure !== 'unknown') check(stats.requests === 1, 'Actual image request occurred');
          check(canvas.renderOnAddRemove === automatic, `Expected renderOnAddRemove=${automatic}, got ${canvas.renderOnAddRemove}`);
          check(canvas.getObjects().length === 1 && canvas.getObjects()[0] === old, 'Original object identity retained before commit');
          check(JSON.stringify(old.toObject()) === before, 'Original object properties retained');
          check(canvas.backgroundColor === '#ffffff', 'Original canvas property retained');
          await frames();
          check(JSON.stringify(pixel(20, 20)) === '[255,0,0,255]', 'Original document pixels retained');

          async function editAndCheck(left) {
            const added = new fabric.Rect({ left, top: 55, width: 20, height: 20, fill: '#0000ff', strokeWidth: 0 });
            const x = left + 5;
            canvas.add(added);
            await frames();
            check(JSON.stringify(pixel(x, 60)) === (automatic ? '[0,0,255,255]' : '[255,255,255,255]'), 'Add respects original automatic render setting');
            if (!automatic) { canvas.requestRenderAll(); await frames(); }
            check(JSON.stringify(pixel(x, 60)) === '[0,0,255,255]', 'Added object is visibly rendered');
            canvas.remove(added);
            await frames();
            check(JSON.stringify(pixel(x, 60)) === (automatic ? '[255,255,255,255]' : '[0,0,255,255]'), 'Remove respects original automatic render setting');
            if (!automatic) { canvas.requestRenderAll(); await frames(); }
            check(JSON.stringify(pixel(x, 60)) === '[255,255,255,255]', 'Removed object is visibly absent');
          }
          await editAndCheck(65);
          const success = await run({ background: '#ffffff', objects: [{ type: 'Rect', left: 105, top: 10, width: 24, height: 24, fill: '#00ff00', strokeWidth: 0 }] });
          check(success.status === 'loaded', 'Retry on same canvas completed');
          await frames();
          check(canvas.getObjects().length === 1 && canvas.getObjects()[0] !== old, 'Retry replaced original document');
          check(JSON.stringify(pixel(20, 20)) === '[255,255,255,255]', 'Retry cleared old visible content');
          check(JSON.stringify(pixel(115, 20)) === '[0,255,0,255]', 'Successful load requests an actual render');
          check(canvas.renderOnAddRemove === automatic, 'Successful retry preserves original setting');
          await editAndCheck(65);
          // Release any still-open source only after the replacement is visible.
          if (failure === 'cancel') await fetch(`/release?id=${id}`);
          await frames();
          check(JSON.stringify(pixel(115, 20)) === '[0,255,0,255]', 'No cancelled operation overwrites retry');
          await canvas.dispose();
          element.remove();
          return { status: outcome.status, requestStarted, imageRequests: stats.requests, oldIdentityPreserved: true, retryVisible: true, continuedEditingVisible: true };
        }, { automatic, failure });
        results.push({ name, pass: true, ...result });
      } catch (error) {
        results.push({ name, pass: false, error: error.message });
      }
    }
  }

  if (!baseline) {
    // Catches a strict policy that is missing, or claims to cover nested assets.
    const omissions = await page.evaluate(async () => {
      const { fabric, recipe } = window.fixture;
      const canvas = new fabric.StaticCanvas(document.createElement('canvas'), { width: 100, height: 100 });
      const observed = [];
      const id = `omission-${Date.now()}`;
      const image = { type: 'Image', src: `/missing.png?id=${id}`, width: 20, height: 20 };
      await canvas.loadFromJSON({ objects: [image, { type: 'Rect', width: 10, height: 10 }] }, (_json, object, error) => {
        observed.push({ hasObject: Boolean(object), hasError: Boolean(error), message: error?.message });
      });
      const defaultResult = { objects: canvas.getObjects().length, observed, requests: (await fetch(`/stats?id=${id}`).then((r) => r.json())).requests };
      const nestedId = `nested-${Date.now()}`;
      const backgroundId = `background-${Date.now()}`;
      const strictResult = await recipe.loadDocument(canvas, {
        objects: [{ type: 'Group', objects: [{ ...image, src: `/missing.png?id=${nestedId}` }, { type: 'Rect', width: 10, height: 10 }] }],
        backgroundImage: { ...image, src: `/missing.png?id=${backgroundId}` },
      });
      const boundary = {
        status: strictResult.status,
        groupChildren: canvas.getObjects()[0].getObjects().length,
        backgroundOmitted: canvas.backgroundImage === undefined,
        nestedRequests: (await fetch(`/stats?id=${nestedId}`).then((r) => r.json())).requests,
        backgroundRequests: (await fetch(`/stats?id=${backgroundId}`).then((r) => r.json())).requests,
      };
      await canvas.dispose();
      return { defaultResult, boundary };
    });
    assert.equal(omissions.defaultResult.requests, 1);
    assert.equal(omissions.defaultResult.objects, 1);
    assert.equal(omissions.defaultResult.observed.length, 2);
    assert.equal(omissions.defaultResult.observed.filter((o) => o.hasError && !o.hasObject).length, 1);
    assert.match(omissions.defaultResult.observed[0].message, /missing\.png/);
    assert.deepEqual(omissions.boundary, { status: 'loaded', groupChildren: 1, backgroundOmitted: true, nestedRequests: 1, backgroundRequests: 1 });
    results.push({ name: 'Actual 404 callbacks and nested/background omission boundary', pass: true, ...omissions });

    // The published demo must serialize loads and restore editing controls.
    await page.goto(server.url);
    await page.locator('#valid').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Loaded.'));
    await page.waitForFunction(() => [...document.querySelector('canvas').getContext('2d').getImageData(300, 50, 1, 1).data].join(',') === '39,132,71,255');
    await page.locator('#missing').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Load failed.'));
    assert.match(await page.locator('#status').textContent(), /missing\.png/);
    const imageStarted = page.waitForRequest((request) => new URL(request.url()).pathname === '/pending.png');
    await page.locator('#pending').click();
    await imageStarted;
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Loading.'));
    assert.equal(await page.locator('#add').isDisabled(), true);
    assert.equal(await page.locator('#valid').isDisabled(), true);
    assert.equal(await page.locator('#automatic').isDisabled(), true);
    assert.equal(await page.locator('#cancel').isEnabled(), true);
    await page.locator('#cancel').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Cancelled.'));
    assert.equal(await page.locator('#add').isEnabled(), true);
    assert.equal(await page.locator('#valid').isEnabled(), true);
    assert.equal(await page.locator('#automatic').isEnabled(), true);
    assert.equal(await page.locator('#cancel').isDisabled(), true);
    await page.locator('#valid').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Loaded.'));
    await page.locator('#add').click();
    await page.waitForFunction(() => [...document.querySelector('canvas').getContext('2d').getImageData(180, 160, 1, 1).data].join(',') === '39,95,209,255');
    await page.locator('#remove').click();
    await page.waitForFunction(() => [...document.querySelector('canvas').getContext('2d').getImageData(180, 160, 1, 1).data].join(',') === '255,255,255,255');
    if (process.env.SCREENSHOT_PATH) await page.screenshot({ path: process.env.SCREENSHOT_PATH, fullPage: true });
    results.push({ name: 'Demo pauses competing controls, cancels, retries and visibly edits', pass: true });
  }
  assert.deepEqual(externalRequests, [], 'The browser made no external requests');
  console.log(JSON.stringify({ baseline, fabric: '7.4.0', browser: browser.version(), validation: 'scripted headless browser', externalRequests, results }, null, 2));
  assert.equal(results.filter((r) => !r.pass).length, 0, 'Browser acceptance failures');
} finally {
  await browser.close();
  await server.close();
}
