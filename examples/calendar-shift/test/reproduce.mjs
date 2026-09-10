import assert from 'node:assert/strict';

import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);
dayjs.extend(timezone);

assert.equal(process.env.TZ, 'UTC', 'the pinned baseline must run under explicit TZ=UTC');

const actual = dayjs
  .utc('2020-10-24T00:00:00.000Z')
  .tz('Europe/London', true)
  .add(2, 'day')
  .toISOString();
const expected = '2020-10-26T00:00:00.000Z';

console.log(`Node=${process.version} ICU=${process.versions.icu} TZ=${process.env.TZ}`);
console.log(`Day.js actual=${actual} expected=${expected}`);
assert.equal(actual, expected, 'unmodified Day.js 1.11.23 must reproduce #1271');
