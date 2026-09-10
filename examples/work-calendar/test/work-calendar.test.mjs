import assert from 'node:assert/strict';
import test from 'node:test';

import { createWorkCalendar } from '../dist/work-calendar.js';

test('adds workdays without counting the starting day', () => {
  const calendar = createWorkCalendar();

  assert.equal(calendar.addWorkdays('2026-01-02', 1), '2026-01-05');
  assert.equal(calendar.addWorkdays('2026-01-03', 1), '2026-01-05');
  assert.equal(calendar.addWorkdays('2026-01-03', -1), '2026-01-02');
  assert.equal(calendar.addWorkdays('2026-01-03', 0), '2026-01-03');
});

test('excludes weekday holidays in both directions and half-open counts', () => {
  const calendar = createWorkCalendar({ holidays: ['2026-01-02'] });

  assert.equal(calendar.addWorkdays('2026-01-01', 1), '2026-01-05');
  assert.equal(calendar.addWorkdays('2026-01-05', -1), '2026-01-01');
  assert.equal(calendar.countWorkdays('2026-01-01', '2026-01-08'), 4);
  assert.equal(calendar.countWorkdays('2026-01-08', '2026-01-01'), -4);
  assert.equal(calendar.countWorkdays('2026-01-01', '2026-01-01'), 0);
});

test('supports custom weekends and reports explicit holidays independently', () => {
  const calendar = createWorkCalendar({
    workingWeekdays: [0, 1, 2, 3, 4],
    holidays: ['2026-01-02', '2026-01-03'],
  });

  assert.equal(calendar.addWorkdays('2026-01-01', 1), '2026-01-04');
  assert.equal(calendar.isHoliday('2026-01-02'), true);
  assert.equal(calendar.isHoliday('2026-01-03'), true);
  assert.equal(calendar.isWorkday('2026-01-02'), false);
  assert.equal(calendar.isWorkday('2026-01-03'), false);
  assert.equal(calendar.isWorkday('2026-01-04'), true);
});

test('normalizes duplicate weekdays and holidays without double subtraction', () => {
  const calendar = createWorkCalendar({
    workingWeekdays: [1, 1, 2, 3, 4, 5, 5],
    holidays: ['2026-01-02', '2026-01-02', '2026-01-03', '2026-01-03'],
  });

  assert.equal(calendar.countWorkdays('2026-01-01', '2026-01-08'), 4);
  assert.equal(calendar.addWorkdays('2026-01-01', 1), '2026-01-05');
});

test('crosses a whole closed working week', () => {
  const calendar = createWorkCalendar({
    holidays: [
      '2026-01-05',
      '2026-01-06',
      '2026-01-07',
      '2026-01-08',
      '2026-01-09',
    ],
  });

  assert.equal(calendar.addWorkdays('2026-01-02', 1), '2026-01-12');
  assert.equal(calendar.addWorkdays('2026-01-12', -1), '2026-01-02');
});

test('supports all seven working days and a single working weekday', () => {
  const everyDay = createWorkCalendar({ workingWeekdays: [0, 1, 2, 3, 4, 5, 6] });
  const Wednesdays = createWorkCalendar({ workingWeekdays: [3] });

  assert.equal(everyDay.addWorkdays('2024-02-28', 1), '2024-02-29');
  assert.equal(everyDay.countWorkdays('2024-02-28', '2024-03-02'), 3);
  assert.equal(Wednesdays.addWorkdays('2026-01-01', 1), '2026-01-07');
  assert.equal(Wednesdays.addWorkdays('2026-01-01', -1), '2025-12-31');
});

test('handles leap years, non-leap centuries, and four-digit boundary years', () => {
  const calendar = createWorkCalendar({ workingWeekdays: [0, 1, 2, 3, 4, 5, 6] });

  assert.equal(calendar.addWorkdays('2000-02-28', 1), '2000-02-29');
  assert.equal(calendar.addWorkdays('1900-02-28', 1), '1900-03-01');
  assert.equal(calendar.addWorkdays('0001-01-01', 1), '0001-01-02');
  assert.equal(calendar.addWorkdays('0099-12-31', 1), '0100-01-01');
  assert.equal(calendar.addWorkdays('9999-12-30', 1), '9999-12-31');
});

test('rejects dates outside the supported domain when selecting results', () => {
  const calendar = createWorkCalendar({ workingWeekdays: [0, 1, 2, 3, 4, 5, 6] });

  assert.throws(() => calendar.addWorkdays('0001-01-01', -1), RangeError);
  assert.throws(() => calendar.addWorkdays('9999-12-31', 1), RangeError);
  assert.throws(() => calendar.addWorkdays('2026-01-01', Number.MAX_SAFE_INTEGER), RangeError);
  assert.throws(() => calendar.addWorkdays('2026-01-01', Number.MIN_SAFE_INTEGER), RangeError);
});

test('rejects malformed date values without normalization', () => {
  const calendar = createWorkCalendar();
  const invalid = [
    '',
    ' 2026-01-01',
    '2026-01-01 ',
    '2026-1-01',
    '2026-01-1',
    '2026-01-01T00:00:00Z',
    '0000-01-01',
    '10000-01-01',
    '2025-02-29',
    '1900-02-29',
    '2024-02-30',
    '2026-13-01',
  ];

  for (const day of invalid) {
    assert.throws(() => calendar.isWorkday(day), RangeError, day);
    assert.throws(() => calendar.isHoliday(day), RangeError, day);
    assert.throws(() => calendar.addWorkdays(day, 0), RangeError, day);
    assert.throws(() => calendar.countWorkdays('2026-01-01', day), RangeError, day);
  }

  assert.throws(() => calendar.isWorkday(20260101), TypeError);
  assert.throws(() => calendar.isHoliday(null), TypeError);
  assert.throws(() => calendar.addWorkdays(undefined, 1), TypeError);
  assert.throws(() => calendar.countWorkdays({}, '2026-01-01'), TypeError);
});

test('rejects invalid options and unknown own keys', () => {
  assert.throws(() => createWorkCalendar(null), TypeError);
  assert.throws(() => createWorkCalendar([]), TypeError);
  assert.throws(() => createWorkCalendar(new Date()), TypeError);
  assert.throws(() => createWorkCalendar({ extra: true }), TypeError);

  const symbolic = { holidays: [] };
  symbolic[Symbol('extra')] = true;
  assert.throws(() => createWorkCalendar(symbolic), TypeError);

  assert.throws(() => createWorkCalendar({ workingWeekdays: '1,2,3' }), TypeError);
  assert.throws(() => createWorkCalendar({ holidays: '2026-01-01' }), TypeError);
  assert.throws(() => createWorkCalendar({ workingWeekdays: [1, '2'] }), TypeError);
  assert.throws(() => createWorkCalendar({ holidays: [20260101] }), TypeError);
  assert.throws(() => createWorkCalendar({ holidays: ['2025-02-29'] }), RangeError);
  assert.throws(() => createWorkCalendar({ holidays: ['2026-1-01'] }), RangeError);
});

test('rejects sparse arrays even when a prototype supplies the hole', () => {
  const sparseWeekdays = [, 2];
  Object.setPrototypeOf(sparseWeekdays, Object.assign(Object.create(Array.prototype), { 0: 1 }));
  const sparseHolidays = [, '2026-01-02'];
  Object.setPrototypeOf(
    sparseHolidays,
    Object.assign(Object.create(Array.prototype), { 0: '2026-01-01' }),
  );

  assert.throws(() => createWorkCalendar({ workingWeekdays: sparseWeekdays }), TypeError);
  assert.throws(() => createWorkCalendar({ holidays: sparseHolidays }), TypeError);
});

test('rejects invalid weekday sets and numeric amounts with the specified error classes', () => {
  assert.throws(() => createWorkCalendar({ workingWeekdays: [] }), RangeError);
  assert.throws(() => createWorkCalendar({ workingWeekdays: [-1] }), RangeError);
  assert.throws(() => createWorkCalendar({ workingWeekdays: [7] }), RangeError);
  assert.throws(() => createWorkCalendar({ workingWeekdays: [1.5] }), RangeError);
  assert.throws(() => createWorkCalendar({ workingWeekdays: [Number.NaN] }), RangeError);

  const calendar = createWorkCalendar();
  assert.throws(() => calendar.addWorkdays('2026-01-01', '1'), TypeError);
  assert.throws(() => calendar.addWorkdays('2026-01-01', Number.NaN), RangeError);
  assert.throws(() => calendar.addWorkdays('2026-01-01', Number.POSITIVE_INFINITY), RangeError);
  assert.throws(() => calendar.addWorkdays('2026-01-01', 1.5), RangeError);
  assert.throws(() => calendar.addWorkdays('2026-01-01', Number.MAX_SAFE_INTEGER + 1), RangeError);
});

test('accepts null-prototype options and is insulated from later configuration mutation', () => {
  const weekdays = [1, 2, 3, 4, 5];
  const holidays = ['2026-01-02'];
  const options = Object.assign(Object.create(null), { workingWeekdays: weekdays, holidays });
  const calendar = createWorkCalendar(options);

  weekdays.splice(0, weekdays.length, 0);
  holidays.splice(0, holidays.length, '2026-01-05');

  assert.equal(calendar.addWorkdays('2026-01-01', 1), '2026-01-05');
  assert.equal(calendar.isHoliday('2026-01-02'), true);
  assert.equal(calendar.isHoliday('2026-01-05'), false);
  assert.equal(Object.isFrozen(calendar), true);
  assert.throws(() => {
    calendar.isWorkday = () => true;
  }, TypeError);
});

test('handles fixed long spans with logarithmic selection', () => {
  const calendar = createWorkCalendar();

  assert.equal(calendar.addWorkdays('2000-01-03', 1_000_000), '5833-01-28');
  assert.equal(calendar.countWorkdays('2000-01-01', '2400-01-01'), 104355);
  assert.equal(calendar.addWorkdays('2000-01-03', 104355), '2400-01-03');
});

function addReference(day, amount, workingWeekdays, holidays) {
  const date = new Date(`${day}T00:00:00Z`);
  const direction = Math.sign(amount);
  let remaining = Math.abs(amount);

  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + direction);
    if (workingWeekdays.has(date.getUTCDay()) && !holidays.has(formatReference(date))) {
      remaining -= 1;
    }
  }

  return formatReference(date);
}

function countReference(start, end, workingWeekdays, holidays) {
  if (start === end) return 0;
  if (start > end) return -countReference(end, start, workingWeekdays, holidays);

  const date = new Date(`${start}T00:00:00Z`);
  const finish = new Date(`${end}T00:00:00Z`);
  let result = 0;
  while (date < finish) {
    if (workingWeekdays.has(date.getUTCDay()) && !holidays.has(formatReference(date))) {
      result += 1;
    }
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return result;
}

function formatReference(date) {
  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

test('matches an independent day-by-day reference over fixed small domains', () => {
  const configurations = [
    { workingWeekdays: [1, 2, 3, 4, 5], holidays: ['2024-02-29', '2024-03-04'] },
    { workingWeekdays: [0, 1, 2, 3, 4], holidays: ['2024-03-01', '2024-03-03'] },
    { workingWeekdays: [0, 1, 2, 3, 4, 5, 6], holidays: ['2024-03-02'] },
    { workingWeekdays: [3], holidays: ['2024-03-06'] },
  ];
  const starts = ['2024-02-27', '2024-02-29', '2024-03-02', '2024-03-07'];
  const amounts = [-12, -5, -1, 0, 1, 4, 11];
  const intervals = [
    ['2024-02-26', '2024-03-12'],
    ['2024-03-12', '2024-02-26'],
    ['2024-02-29', '2024-03-01'],
    ['2024-03-03', '2024-03-03'],
  ];

  for (const configuration of configurations) {
    const calendar = createWorkCalendar(configuration);
    const weekdays = new Set(configuration.workingWeekdays);
    const holidays = new Set(configuration.holidays);

    for (const start of starts) {
      for (const amount of amounts) {
        assert.equal(
          calendar.addWorkdays(start, amount),
          addReference(start, amount, weekdays, holidays),
          JSON.stringify({ configuration, start, amount }),
        );
      }
    }

    for (const [start, end] of intervals) {
      assert.equal(
        calendar.countWorkdays(start, end),
        countReference(start, end, weekdays, holidays),
        JSON.stringify({ configuration, start, end }),
      );
    }
  }
});
