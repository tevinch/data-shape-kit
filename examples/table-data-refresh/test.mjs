import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const events = JSON.parse(await readFile('dist/compiler-events.json', 'utf8'));
const source = await readFile('main.tsx', 'utf8');
const compiled = await readFile('dist/compiled.js', 'utf8');
test('the example actually compiles its components', () => {
  for (const name of ['Body', 'Controls', 'Grid', 'Spacer', 'App']) {
    assert.ok(events.some(event => event.kind === 'CompileSuccess' && event.fnName === name), `${name} must be compiled`);
  }
});
test('only the row model read keeps its manual invalidation dependencies', () => {
  const directiveLine = source.split('\n').findIndex(line => line.includes("'use no memo'")) + 1;
  const skipped = events.filter(event => event.kind === 'CompileSkip');
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0].loc.start.line, directiveLine);
  assert.match(compiled, /useMemo[\s\S]*?\[table, data, state\]/);
});
