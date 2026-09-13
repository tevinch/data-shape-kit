import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chromium } from 'playwright';

export async function openExample(t, query = '') {
  const server = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('..', import.meta.url), stdio: ['ignore', 'pipe', 'pipe'],
  });
  const messages = [];
  server.stderr.on('data', chunk => messages.push(String(chunk)));
  let browser;
  t.after(async () => {
    await browser?.close();
    if (server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit'); }
  });
  const origin = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server did not start: ${messages.join('')}`)), 15_000);
    server.once('error', error => { clearTimeout(timer); reject(error); });
    server.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited ${code}: ${messages.join('')}`)); });
    server.stdout.on('data', chunk => {
      const match = String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) { clearTimeout(timer); resolve(match[0]); }
    });
  });
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1300, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}/${query}`);
  await page.waitForLoadState('networkidle');
  return { page, errors, browserVersion: browser.version() };
}
