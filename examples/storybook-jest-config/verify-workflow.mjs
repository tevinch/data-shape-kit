import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const baseline = process.argv.includes('--baseline');
const output = path.join(here, 'test-results');
await mkdir(output, { recursive: true });
async function command(args, label) {
  const child = spawn(process.execPath, args, {
    cwd: here, env: { ...process.env, STORYBOOK_DISABLE_TELEMETRY: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '', stderr = '';
  child.stdout.on('data', data => { stdout += data; });
  child.stderr.on('data', data => { stderr += data; });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  await writeFile(path.join(output, `${label}.log`), stdout + stderr);
  return { code, stdout, stderr };
}
const core = JSON.parse(await readFile(path.join(here, 'node_modules/storybook/package.json'), 'utf8'));
const coreBinary = typeof core.bin === 'string' ? core.bin : core.bin.storybook;
const build = await command([path.join(here, 'node_modules/storybook', coreBinary), 'build', '--quiet', '--disable-telemetry'], 'build');
assert.equal(build.code, 0, build.stderr);
const staticRoot = path.join(here, 'storybook-static');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let filename = path.resolve(staticRoot, `.${pathname}`);
    if (filename !== staticRoot && !filename.startsWith(staticRoot + path.sep)) throw new Error('Outside static directory');
    if ((await stat(filename)).isDirectory()) filename = path.join(filename, 'index.html');
    const data = await readFile(filename);
    response.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream' });
    response.end(data);
  } catch {
    response.writeHead(404); response.end();
  }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
try {
  const runner = JSON.parse(await readFile(path.join(here, 'node_modules/@storybook/test-runner/package.json'), 'utf8'));
  const binary = path.join(here, 'node_modules/@storybook/test-runner', runner.bin['test-storybook']);
  const url = `http://127.0.0.1:${server.address().port}`;
  for (const [label, config] of baseline ? [['baseline', '.storybook']] : [['typescript', '.storybook'], ['typescript-repeat', '.storybook'], ['javascript', '.storybook-js']]) {
    const result = await command([binary, '--url', url, '--config-dir', config, '--maxWorkers', '1', '--no-cache', '--json'], label);
    const line = result.stdout.split('\n').find(value => value.startsWith('{"numFailedTestSuites"'));
    assert.ok(line, result.stdout + result.stderr);
    const report = JSON.parse(line);
    await writeFile(path.join(output, `${label}.json`), JSON.stringify(report, null, 2) + '\n');
    if (baseline) {
      assert.equal(result.code, 1);
      assert.equal(report.numRuntimeErrorTestSuites, 1);
      assert.match(report.testResults[0].message, /module\.register\(\) is not supported in Jest:/);
      console.log('Original installation reproduced the Jest loader failure');
    } else {
      assert.equal(result.code, 0, result.stderr);
      assert.equal(report.success, true);
      assert.equal(report.numPassedTests, 2);
      assert.equal(report.numTotalTests, 2);
      assert.equal(report.numPendingTests, 0);
      const postVisits = [...(result.stdout + result.stderr).matchAll(/CONFIG_POST_VISIT:([^\s:]+):config-loaded/g)].map(match => match[1]);
      assert.deepEqual(postVisits.sort(), ['config-counter--click-once', 'config-counter--click-twice']);
      console.log(`${label}: two story interactions and configuration hooks passed`);
    }
  }
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
