# Work calendar

Add or subtract working days, count them between dates, and check a date against your own working week and holiday list. The copyable TypeScript core has no runtime dependencies. It uses whole-week counts and binary search, so a long date span does not require visiting every day.

This module works with **calendar dates**, such as `2026-01-05`. Its output is a date, without a time of day. If your input is an instant, the date-fns example below extracts the date in an explicit time zone first.

## Download and check

[Download source and tests v0.1.0](../../downloads/work-calendar-v0.1.0.zip?raw=true), extract it and open a terminal in `work-calendar`:

```sh
npm ci --ignore-scripts
npm test
npm run example
```

The fixture uses Node.js 24.19.0, TypeScript 5.9.3, date-fns 4.4.0 and `@date-fns/tz` 1.5.0. The latter two are development dependencies for the integration example; [`work-calendar.ts`](work-calendar.ts) does not import them. Copy that file into your TypeScript project. This example is distributed through GitHub, with no package-name installation on npm.

## A calendar with a company closure

The holiday below is sample configuration supplied by an application. The module does not fetch or maintain regional holidays.

```ts
import { createWorkCalendar } from './work-calendar.js';

const calendar = createWorkCalendar({
  workingWeekdays: [1, 2, 3, 4, 5],
  holidays: ['2026-01-02'],
});

console.log(calendar.addWorkdays('2026-01-01', 1)); // 2026-01-05
console.log(calendar.addWorkdays('2026-01-05', -1)); // 2026-01-01
console.log(calendar.countWorkdays('2026-01-01', '2026-01-08')); // 4
console.log(calendar.countWorkdays('2026-01-08', '2026-01-01')); // -4
console.log(calendar.isWorkday('2026-01-02')); // false
console.log(calendar.isHoliday('2026-01-02')); // true
```

Weekday numbers use **0 = Sunday** through **6 = Saturday**. For a Friday/Saturday weekend, pass `[0, 1, 2, 3, 4]`. One working weekday, all seven weekdays, and duplicate entries are supported; duplicates are normalized. At least one working weekday is required.

## Using date-fns with an explicit time zone

`addBusinessDays` in date-fns 4.4.0 counts Monday through Friday. To apply your exception list, extract the date in the calendar's time zone and pass that date to the custom calendar:

```ts
import { addBusinessDays, format } from 'date-fns';
import { tz } from '@date-fns/tz';
import { createWorkCalendar } from './work-calendar.js';

const instant = new Date('2026-01-01T12:00:00+08:00');
const context = { in: tz('Asia/Shanghai') };
const day = format(instant, 'yyyy-MM-dd', context);
const calendar = createWorkCalendar({ holidays: ['2026-01-02'] });

console.log(day); // 2026-01-01
console.log(calendar.addWorkdays(day, 1)); // 2026-01-05
console.log(format(addBusinessDays(instant, 1, context), 'yyyy-MM-dd', context));
// 2026-01-02: the native weekday-only calculation
```

The returned `2026-01-05` is a calendar date. Converting it to an instant or retaining a previous clock time requires an explicit time zone and a policy for missing or repeated local times. This module does not perform that conversion. See the separate [calendar shift example](../calendar-shift) for explicit wall-clock arithmetic.

## API and boundaries

`createWorkCalendar(options?)` returns a frozen object with four methods:

| Method | Result |
| --- | --- |
| `isWorkday(day)` | Whether the day is a configured working weekday and is absent from the holiday list |
| `isHoliday(day)` | Whether the date is explicitly in the holiday list, including a holiday on a weekend |
| `addWorkdays(day, amount)` | The date reached after counting working dates in the requested direction |
| `countWorkdays(start, end)` | Working dates in the half-open interval `[start, end)`; a reversed interval returns the negative count |

A nonzero offset **excludes the starting date**. Positive offsets move forward, negative offsets move backward. A zero offset returns the validated starting date unchanged, even on a weekend or holiday. With the default calendar, Saturday `2026-01-03` plus one is Monday `2026-01-05`, minus one is Friday `2026-01-02`, and plus zero remains Saturday.

The count **includes the earlier endpoint and excludes the later endpoint**, with a negative sign for a reversed input interval. Equal endpoints return 0. This contract is explicit and should not be assumed to match another library's similarly named difference function. It counts dates, not working hours or elapsed durations.

Options default to working weekdays `[1, 2, 3, 4, 5]` and no holidays. Omitted or `undefined` optional fields use those defaults. Configuration arrays are copied; later changes to the supplied arrays do not alter an existing calendar. A holiday already on a non-working weekday is not subtracted twice.

## Input validation

Dates must be exact `YYYY-MM-DD` Gregorian dates from **0001-01-01 through 9999-12-31**. The module rejects invalid dates instead of normalizing them, including `2026-02-29`, padded whitespace, incomplete dates and timestamp strings. It uses integer Gregorian calendar arithmetic, including for years below 100, so date-only operations are independent of the machine's local time zone.

Options must be a plain object with only `workingWeekdays` and `holidays`. Arrays must be dense; a hole remains invalid even if an inherited property supplies a value. Weekdays must be integers from 0 through 6. Holiday values must be valid date strings. Offsets must be safe integers.

Wrong input types or shapes throw `TypeError`; invalid date formats, numeric ranges, an empty working-week set or a result outside the supported date range throw `RangeError`. The module does not coerce strings into numbers, choose a fallback date or clamp an out-of-range result.

## Long intervals and verification

The calendar prepares a sorted set of holiday dates on working weekdays. Counts use whole weeks, at most six remaining days and holiday searches. Adding or subtracting selects a working-day rank with bounded binary search. If H is the number of configured holidays and D is the supported date domain, count queries take O(log(H) + 7) and offset queries take O(log(D) × (log(H) + 7)); configuration takes O(H log(H)) for the holidays. These are algorithmic bounds, not measured response-time guarantees.

For example, the default calendar adds 1,000,000 working days to `2000-01-03` and returns `5833-01-28`. Tests also verify a full Gregorian 400-year cycle, custom weekends, weekday and weekend holidays, closed weeks, leap and century boundaries, reversed intervals, non-working start dates, invalid inputs and independent configuration.

An independent day-by-day reference checks small custom-calendar cases. The actual date-fns integration is checked in fresh processes with host time zones UTC, America/New_York, Europe/London, Asia/Shanghai and Pacific/Apia. Tests also compile a consumer of the generated declarations. The source download includes the tests and example.

## Background and scope

[date-fns #584](https://github.com/date-fns/date-fns/issues/584) requests workday arithmetic and counts with custom non-working dates, including efficient handling of long intervals. Related requests appear in [#2823](https://github.com/date-fns/date-fns/issues/2823), and [PR #3480](https://github.com/date-fns/date-fns/pull/3480) proposes custom business days and exceptions. This independent adapter offers a date-only option with caller-owned calendar data; it is not an upstream date-fns change.

The module does not include national holiday rules, automatic observed-day shifts, one-off working-weekend overrides, business-hour schedules or time-of-day arithmetic. Supply the actual closure dates your application intends to exclude. Regional or company calendar changes require updated configuration.

## License

[MIT](LICENSE). Use, modify and share the code while retaining the license notice.

## Buy me a coffee, if this helped

This code is free to use, modify and share. If it saved you some time and you feel like buying me a coffee, a small contribution is welcome. There is no obligation; feedback and useful examples are appreciated too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
