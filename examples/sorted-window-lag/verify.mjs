import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {compile, version as liteVersion} from 'vega-lite';
import {parse, View, changeset, version as vegaVersion} from 'vega';
import {rows, checkValues} from './fixture.mjs';

const original = JSON.parse(await fs.readFile(new URL('./spec.json', import.meta.url)));
const results = [];
await fs.mkdir(new URL('./verification/', import.meta.url), {recursive: true});
for (const ignorePeers of [false, true]) {
  for (const sortField of [null, '__row__', 'date']) {
    const spec = structuredClone(original);
    if (!ignorePeers) delete spec.transform[0].ignorePeers;
    if (sortField) spec.transform[0].sort = [{field: sortField, order: 'descending'}];
    else delete spec.transform[0].sort;
    const compiled = compile(spec).spec;
    const transformed = compiled.data.find(d => d.transform?.some(t => t.type === 'window'));
    assert(transformed, 'Compiled spec must contain the actual window transform');
    const errors = [], warnings = [];
    const logger = {
      level: () => logger,
      error: (...v) => errors.push(v.map(x => x?.message || String(x)).join(' ')),
      warn: (...v) => warnings.push(v.map(String).join(' ')), info() {}, debug() {},
    };
    const view = new View(parse(compiled), {renderer: 'none', logger});
    view.width(800).height(300);
    try {
      for (const [round, input] of [rows, [...rows].reverse()].entries()) {
        view.change('dataset', changeset().remove(() => true).insert(structuredClone(input)));
        await view.runAsync();
        if (!ignorePeers && sortField) {
          assert.equal(errors.length, 1, 'Original sorted spec must reproduce the runtime error');
          assert.match(errors[0], /Cannot read properties of undefined/);
          results.push({ignorePeers, sortField, expectedBoundaryError: true});
          break;
        }
        assert.deepEqual(errors, []);
        // The container-width spec has a resize listener; Node has no window.
        // Retain that listener and permit only this environment warning.
        assert.deepEqual(warnings, ['Can not resolve event source: window']);
        const actual = view.data(transformed.name);
        checkValues(actual, input, sortField);
        const svg = await view.toSVG();
        const bars = (svg.match(/aria-roledescription="bar"/g) || []).length;
        assert.equal(bars, input.length, 'The complete chart must render');
        const name = `${ignorePeers ? 'configured' : 'original'}-${sortField || 'no-sort'}-${round}`;
        await fs.writeFile(new URL(`./verification/${name}.svg`, import.meta.url), svg);
        results.push({ignorePeers, sortField, round, rows: actual.length, bars, allLagValuesCorrect: true});
      }
    } finally {
      view.finalize();
    }
  }
}
const report = {vegaVersion, liteVersion, mode: 'Scripted Node runtime and SVG checks using synthetic data', results};
await fs.writeFile(new URL('./verification/results.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
