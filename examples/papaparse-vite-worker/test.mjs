import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Papa from 'papaparse';
import { fixtures, resultMatches } from './fixtures.mjs';

for (const fixture of fixtures) {
  test(`fixture is valid: ${fixture.name}`, async () => {
    const text = fixture.path
      ? await readFile(new URL(`./public/${fixture.path}`, import.meta.url), 'utf8')
      : fixture.text;
    const result = Papa.parse(text, fixture.config);
    assert.deepEqual(result.data, fixture.data);
    assert.deepEqual(result.errors, []);
    if (fixture.fields) assert.deepEqual(result.meta.fields, fixture.fields);
    assert.equal(resultMatches(result, fixture), true);
  });
}

test('a malformed worker result is not accepted just because its row count matches', () => {
  const fixture = fixtures[0];
  assert.equal(resultMatches({ data: [null, null], errors: [], meta: { fields: [...fixture.fields, ['reportName', 'Example', 'string']] } }, fixture), false);
  assert.equal(resultMatches({ data: fixture.data, errors: [{ code: 'TooManyFields' }], meta: { fields: fixture.fields } }, fixture), false);
  assert.equal(resultMatches({ data: fixture.data, errors: [], meta: { fields: ['wrong'] } }, fixture), false);
  assert.equal(resultMatches(null, fixture), false);
});
