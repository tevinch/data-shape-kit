import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const events = JSON.parse(await readFile('dist/compiler-events.json', 'utf8'));
test('the example actually compiles its components', () => {
  for (const name of ['Body', 'Controls', 'Grid', 'Spacer', 'App']) {
    assert.ok(events.some(event => event.kind === 'CompileSuccess' && event.fnName === name), `${name} must be compiled`);
  }
});
