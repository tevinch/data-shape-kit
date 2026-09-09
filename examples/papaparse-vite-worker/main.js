import Papa from 'papaparse';
import { fixtures, resultMatches } from './fixtures.mjs';

const button = document.querySelector('#run');
const status = document.querySelector('#status');
const rows = document.querySelector('#results');
const details = document.querySelector('#details');

function check(fixture, worker) {
  return new Promise((resolve) => {
    if (worker && !Papa.WORKERS_SUPPORTED) {
      resolve({ status: 'unsupported', message: 'This browser does not support the required Worker.' });
      return;
    }
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => finish({ status: 'timeout', message: 'No result after 5 seconds. Check the browser console and reload before retrying.' }), 5000);
    const input = fixture.path ? new URL(fixture.path, location.href).href : fixture.text;
    try {
      Papa.parse(input, {
        ...fixture.config, worker, download: Boolean(fixture.path),
        complete(result) {
          finish({ status: resultMatches(result, fixture) ? 'pass' : 'mismatch', result });
        },
        error(error) { finish({ status: 'error', message: String(error) }); },
      });
    } catch (error) {
      finish({ status: 'error', message: String(error) });
    }
  });
}

button.addEventListener('click', async () => {
  button.disabled = true;
  rows.replaceChildren();
  details.textContent = '';
  const results = [];
  try {
    for (const fixture of fixtures) {
      for (const worker of [false, true]) {
        status.textContent = `Running ${results.length + 1} of 8 checks…`;
        const result = await check(fixture, worker);
        results.push({ name: fixture.name, worker, ...result });
        const row = document.createElement('tr');
        for (const text of [fixture.name, worker ? 'Worker' : 'Main thread', result.status.toUpperCase()]) {
          const cell = document.createElement('td');
          cell.textContent = text;
          row.append(cell);
        }
        row.dataset.status = result.status;
        rows.append(row);
      }
    }
    const passed = results.filter((result) => result.status === 'pass').length;
    status.textContent = `${passed} of 8 checks passed.`;
    details.textContent = JSON.stringify(results, null, 2);
  } finally {
    button.disabled = false;
  }
});
