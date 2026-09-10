import assert from 'node:assert/strict';

import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

import { shiftCalendar } from '../dist/calendar-shift.js';

dayjs.extend(utc);
dayjs.extend(timezone);

function expectIso(actualEpoch, expectedIso, label) {
  assert.equal(new Date(actualEpoch).toISOString(), expectedIso, label);
}

function expectRangeError(operation, label) {
  assert.throws(
    operation,
    (error) => error instanceof RangeError,
    `${label} must throw RangeError`,
  );
}

// Day.js #1271: two London calendar days span 49 hours across fall-back.
const londonStart = Date.parse('2020-10-23T23:00:00.000Z');
const londonResult = shiftCalendar(londonStart, 2, 'day', 'Europe/London');
expectIso(
  londonResult,
  '2020-10-26T00:00:00.000Z',
  'London midnight stays midnight across fall-back',
);
assert.equal(londonResult - londonStart, 49 * 60 * 60 * 1_000);

// Actual Day.js integration: a known instant enters and leaves through public APIs.
const londonDayjs = dayjs.utc('2020-10-23T23:00:00.000Z').tz('Europe/London');
assert.equal(londonDayjs.format('YYYY-MM-DD HH:mm:ss.SSS Z'), '2020-10-24 00:00:00.000 +01:00');
const dayjsResult = shiftCalendar(
  londonDayjs.valueOf(),
  2,
  'day',
  'Europe/London',
);
assert.equal(dayjs.utc(dayjsResult).toISOString(), '2020-10-26T00:00:00.000Z');
assert.equal(
  dayjs.utc(dayjsResult).tz('Europe/London').format('YYYY-MM-DD HH:mm:ss.SSS Z'),
  '2020-10-26 00:00:00.000 +00:00',
);

// Week shifts retain 05:00 in New York across spring-forward and reverse cleanly.
const nyWeekStart = Date.parse('2020-03-04T10:00:00.000Z');
const nyWeekEnd = shiftCalendar(nyWeekStart, 1, 'week', 'America/New_York');
expectIso(nyWeekEnd, '2020-03-11T09:00:00.000Z', 'week shift retains New York wall time');
expectIso(
  shiftCalendar(nyWeekEnd, -1, 'week', 'America/New_York'),
  '2020-03-04T10:00:00.000Z',
  'negative week reverses an unambiguous week shift',
);

const nyAugust = Date.parse('2025-08-14T04:00:00.000Z');
const nyAfterTenDaysBack = shiftCalendar(nyAugust, -10, 'day', 'America/New_York');
expectIso(nyAfterTenDaysBack, '2025-08-04T04:00:00.000Z', 'negative day count');
expectIso(
  shiftCalendar(nyAfterTenDaysBack, 3, 'month', 'America/New_York'),
  '2025-11-04T05:00:00.000Z',
  'month shift keeps midnight when the offset changes',
);

// New York one-hour gap, including millisecond preservation.
const nyGapStart = Date.parse('2024-03-09T07:30:00.123Z');
expectRangeError(
  () => shiftCalendar(nyGapStart, 1, 'day', 'America/New_York'),
  'default gap disambiguation',
);
expectIso(
  shiftCalendar(nyGapStart, 1, 'day', 'America/New_York', { disambiguation: 'earlier' }),
  '2024-03-10T06:30:00.123Z',
  'earlier gap choice',
);
for (const disambiguation of ['later', 'compatible']) {
  expectIso(
    shiftCalendar(nyGapStart, 1, 'day', 'America/New_York', { disambiguation }),
    '2024-03-10T07:30:00.123Z',
    `${disambiguation} gap choice`,
  );
}

// New York one-hour overlap.
const nyOverlapStart = Date.parse('2024-11-02T05:30:00.123Z');
expectRangeError(
  () => shiftCalendar(nyOverlapStart, 1, 'day', 'America/New_York'),
  'default overlap disambiguation',
);
for (const disambiguation of ['earlier', 'compatible']) {
  expectIso(
    shiftCalendar(nyOverlapStart, 1, 'day', 'America/New_York', { disambiguation }),
    '2024-11-03T05:30:00.123Z',
    `${disambiguation} overlap choice`,
  );
}
expectIso(
  shiftCalendar(nyOverlapStart, 1, 'day', 'America/New_York', { disambiguation: 'later' }),
  '2024-11-03T06:30:00.123Z',
  'later overlap choice',
);

// Lord Howe's transition is 30 minutes, not one hour.
const lordHoweOverlapStart = Date.parse('2024-04-05T14:45:00.250Z');
expectRangeError(
  () => shiftCalendar(lordHoweOverlapStart, 1, 'day', 'Australia/Lord_Howe'),
  'Lord Howe overlap rejects by default',
);
expectIso(
  shiftCalendar(lordHoweOverlapStart, 1, 'day', 'Australia/Lord_Howe', {
    disambiguation: 'earlier',
  }),
  '2024-04-06T14:45:00.250Z',
  'Lord Howe earlier overlap choice',
);
expectIso(
  shiftCalendar(lordHoweOverlapStart, 1, 'day', 'Australia/Lord_Howe', {
    disambiguation: 'later',
  }),
  '2024-04-06T15:15:00.250Z',
  'Lord Howe later overlap choice',
);

const lordHoweGapStart = Date.parse('2024-10-04T15:45:00.250Z');
expectRangeError(
  () => shiftCalendar(lordHoweGapStart, 1, 'day', 'Australia/Lord_Howe'),
  'Lord Howe gap rejects by default',
);
expectIso(
  shiftCalendar(lordHoweGapStart, 1, 'day', 'Australia/Lord_Howe', {
    disambiguation: 'earlier',
  }),
  '2024-10-05T15:15:00.250Z',
  'Lord Howe earlier gap choice',
);
expectIso(
  shiftCalendar(lordHoweGapStart, 1, 'day', 'Australia/Lord_Howe', {
    disambiguation: 'compatible',
  }),
  '2024-10-05T15:45:00.250Z',
  'Lord Howe compatible gap choice',
);

// Apia skipped all of 2011-12-30 when moving from UTC-10 to UTC+14.
const apiaStart = Date.parse('2011-12-29T22:00:00.500Z');
expectRangeError(
  () => shiftCalendar(apiaStart, 1, 'day', 'Pacific/Apia'),
  'Apia skipped date rejects by default',
);
expectIso(
  shiftCalendar(apiaStart, 1, 'day', 'Pacific/Apia', { disambiguation: 'earlier' }),
  '2011-12-29T22:00:00.500Z',
  'Apia earlier choice moves before the skipped date',
);
for (const disambiguation of ['later', 'compatible']) {
  expectIso(
    shiftCalendar(apiaStart, 1, 'day', 'Pacific/Apia', { disambiguation }),
    '2011-12-30T22:00:00.500Z',
    `Apia ${disambiguation} choice moves after the skipped date`,
  );
}

// UTC and fixed offsets have no daylight-saving transition.
expectIso(
  shiftCalendar(Date.parse('2024-06-01T12:34:56.789Z'), -3, 'day', 'UTC'),
  '2024-05-29T12:34:56.789Z',
  'UTC negative day shift',
);
expectIso(
  shiftCalendar(Date.parse('2024-01-01T18:45:00.321Z'), 1, 'day', '+05:30'),
  '2024-01-02T18:45:00.321Z',
  'positive offset identifier',
);
expectIso(
  shiftCalendar(Date.parse('2024-01-01T04:30:00.321Z'), -1, 'day', '-04:00'),
  '2023-12-31T04:30:00.321Z',
  'negative offset identifier',
);

// Calendar overflow is constrained by default and rejectable explicitly.
const leapJanuaryEnd = Date.parse('2024-01-31T12:00:00.000Z');
expectIso(
  shiftCalendar(leapJanuaryEnd, 1, 'month', 'UTC'),
  '2024-02-29T12:00:00.000Z',
  'month-end defaults to constrain',
);
expectRangeError(
  () => shiftCalendar(leapJanuaryEnd, 1, 'month', 'UTC', { overflow: 'reject' }),
  'month-end reject overflow',
);
expectIso(
  shiftCalendar(Date.parse('2024-02-29T08:15:00.444Z'), 1, 'year', 'UTC'),
  '2025-02-28T08:15:00.444Z',
  'leap day year defaults to constrain',
);
expectIso(
  shiftCalendar(Date.parse('2024-02-29T08:15:00.444Z'), -4, 'year', 'UTC'),
  '2020-02-29T08:15:00.444Z',
  'negative leap-year shift',
);

// Zero is an identity even when the source wall time is repeated.
for (const overlapOccurrence of [
  Date.parse('2024-11-03T05:30:00.123Z'),
  Date.parse('2024-11-03T06:30:00.123Z'),
]) {
  assert.equal(
    shiftCalendar(overlapOccurrence, 0, 'day', 'America/New_York'),
    overlapOccurrence,
  );
}

// Runtime validation rejects unsafe or unsupported input instead of coercing it.
for (const epoch of [
  NaN,
  Infinity,
  1.5,
  -8_640_000_000_000_001,
  8_640_000_000_000_001,
]) {
  expectRangeError(() => shiftCalendar(epoch, 1, 'day', 'UTC'), `invalid epoch ${epoch}`);
}
for (const amount of [NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
  expectRangeError(() => shiftCalendar(0, amount, 'day', 'UTC'), `invalid amount ${amount}`);
}
assert.throws(() => shiftCalendar('0', 1, 'day', 'UTC'), /epochMilliseconds/);
assert.throws(() => shiftCalendar(0, 1, 'hour', 'UTC'), /unit/);
assert.throws(() => shiftCalendar(0, 1, 'day', ''), /timeZone/);
assert.throws(() => shiftCalendar(0, 1, 'day', 123), /timeZone/);
expectRangeError(() => shiftCalendar(0, 1, 'day', 'Mars/Olympus'), 'unknown zone');
expectRangeError(
  () => shiftCalendar(0, 0, 'day', 'Mars/Olympus'),
  'zero amount still validates the zone',
);
assert.throws(() => shiftCalendar(0, 1, 'day', 'UTC', null), /options/);
assert.throws(() => shiftCalendar(0, 1, 'day', 'UTC', []), /options/);
assert.throws(
  () => shiftCalendar(0, 1, 'day', 'UTC', { disambiguation: 'middle' }),
  /disambiguation/,
);
assert.throws(
  () => shiftCalendar(0, 1, 'day', 'UTC', { overflow: 'balance' }),
  /overflow/,
);
assert.throws(
  () => shiftCalendar(0, 0, 'day', 'UTC', { disambiguation: undefined }),
  /disambiguation/,
);
assert.throws(
  () => shiftCalendar(0, 0, 'day', 'UTC', { overflow: undefined }),
  /overflow/,
);
assert.throws(
  () => shiftCalendar(0, 0, 'day', 'UTC', { disambiguation: null }),
  /disambiguation/,
);
assert.throws(
  () => shiftCalendar(0, 0, 'day', 'UTC', { overflow: null }),
  /overflow/,
);
assert.throws(
  () => shiftCalendar(0, 0, 'day', 'UTC', { ignored: true }),
  /unknown option/,
);

console.log(`PASS TZ=${process.env.TZ} Node=${process.version} ICU=${process.versions.icu}`);
