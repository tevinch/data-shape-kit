import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const fixture = fileURLToPath(new URL('./fixture.mjs', import.meta.url));
const hosts = [
  'UTC',
  'Europe/London',
  'America/Santiago',
  'America/New_York',
  'Asia/Shanghai',
];

for (const host of hosts) {
  test(`calendar shifts are independent of host TZ=${host}`, () => {
    const result = spawnSync(process.execPath, [fixture], {
      encoding: 'utf8',
      env: { ...process.env, TZ: host },
    });

    assert.equal(
      result.status,
      0,
      [
        `fixture failed under TZ=${host}`,
        result.stdout.trim(),
        result.stderr.trim(),
      ]
        .filter(Boolean)
        .join('\n'),
    );
    assert.match(result.stdout, new RegExp(`PASS TZ=${host.replace('/', '\\/')}`));
  });
}
