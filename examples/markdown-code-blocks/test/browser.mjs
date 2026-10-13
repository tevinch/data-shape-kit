import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { cases } from './cases.mjs';
const result = { mode: 'software-operated Chrome', humanValidation: false, checks: [], errors: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
result.browserVersion = browser.version();
try {
  const page = await browser.newPage();
  page.on('pageerror', error => result.errors.push(error.message));
  await page.goto('http://127.0.0.1:49186/?stock');
  await page.waitForFunction(() => window.editor);
  assert.equal(await page.locator('.tiptap pre').count(), 0);
  result.checks.push('Unmodified extension loses the original code block in Chrome');
  await page.goto('http://127.0.0.1:49186/');
  await page.locator('.tiptap pre').waitFor();
  const initial = 'if ready:\n    print("Hello")';
  assert.equal(await page.locator('.tiptap code').innerText(), initial);
  assert.equal(await page.locator('.tiptap code').getAttribute('class'), 'syntax-python');
  assert.equal(await page.locator('.tiptap pre').getAttribute('class'), 'code-sample');
  result.checks.push('Original import and HTML settings are present');
  // Focus the actual code block, then use browser keyboard input.
  await page.locator('.tiptap code').click();
  await page.evaluate(() => {
    const code = document.querySelector('.tiptap code');
    const range = document.createRange(); range.selectNodeContents(code); range.collapse(false);
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
    document.querySelector('.tiptap').focus();
  });
  await page.keyboard.press('End');
  await page.keyboard.press('Tab');
  await page.keyboard.type('# changed');
  let expected = initial + '  # changed';
  assert.equal(await page.locator('.tiptap code').innerText(), expected);
  result.checks.push('Configured Tab inserts exactly two spaces during real typing');
  for (let i = 0; i < 3; i++) await page.keyboard.press('Enter');
  expected += '\n\n\n';
  assert.equal(await page.evaluate(() => window.editor.state.selection.$from.parent.type.name), 'codeBlock');
  assert.equal(await page.locator('.tiptap code').textContent(), expected);
  result.checks.push('exitOnTripleEnter=false keeps three newlines in code');
  for (let turn = 0; turn < 3; turn++) {
    await page.locator('#save').click();
    await page.locator('#reopen').click();
    assert.equal(await page.locator('.tiptap code').textContent(), expected);
    assert.deepEqual(await page.evaluate(() => window.editor.getJSON().content.map(n => n.type)), ['paragraph', 'codeBlock', 'paragraph']);
    result.checks.push(`Save and destroy/reopen ${turn + 1} preserves edited code and paragraph boundaries`);
  }
  await page.locator('#readonly').check();
  assert.equal(await page.locator('.tiptap').getAttribute('contenteditable'), 'false');
  await page.locator('.tiptap code').click();
  await page.keyboard.type('SHOULD NOT APPEAR');
  assert.equal(await page.locator('.tiptap code').textContent(), expected);
  await page.locator('#reopen').click();
  assert.equal(await page.locator('.tiptap').getAttribute('contenteditable'), 'false');
  result.checks.push('Read-only setting prevents typing and survives reopening');
  await page.locator('#readonly').uncheck();
  await page.locator('#source').fill('before\n\n  ~~~~markdown\n  ```js\n  x()\n  ```\n  ~~~~\n\nafter');
  await page.locator('#import').click();
  expected = '```js\nx()\n```';
  assert.equal(await page.locator('.tiptap code').textContent(), expected);
  for (let turn = 0; turn < 3; turn++) {
    await page.locator('#save').click(); await page.locator('#reopen').click();
    assert.equal(await page.locator('.tiptap code').textContent(), expected);
  }
  result.checks.push('Tilde import containing backtick fences survives three saves');
  for (const value of cases) {
    await page.locator('#source').fill(value.source);
    await page.locator('#import').click();
    for (let turn = 0; turn < 3; turn++) {
      assert.equal(await page.locator('.tiptap code').textContent(), value.text, value.name);
      const json = await page.evaluate(() => window.editor.getJSON());
      assert.deepEqual(json.content.map(node => node.type), ['paragraph', 'codeBlock', 'paragraph']);
      assert.equal(json.content[1].attrs.language, value.language);
      assert.equal(json.content[0].content[1].text, 'bold');
      assert.equal(json.content[0].content[1].marks[0].type, 'bold');
      assert.equal(json.content[2].content[0].text, 'after');
      await page.locator('#save').click(); await page.locator('#reopen').click();
    }
    assert.equal(await page.locator('.tiptap code').textContent(), value.text);
    result.checks.push(value.name + ': browser import and three save/reopen cycles');
  }
  assert.deepEqual(result.errors, []);
  result.passed = true;
} catch (error) {
  result.failure = error.stack; process.exitCode = 1;
} finally {
  await browser.close();
  console.log(JSON.stringify(result, null, 2));
}
