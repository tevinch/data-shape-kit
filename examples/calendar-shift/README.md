# Calendar shift

Add or subtract calendar days, weeks, months and years in a chosen time zone. Keep the local time when it exists, preserve milliseconds, and choose how to handle times that occur twice or never occur.

Free MIT TypeScript source: [calendar-shift.ts](calendar-shift.ts). [Download source and checks](../../downloads/calendar-shift-v0.1.0.zip?raw=true).

## Use with Day.js

Copy `calendar-shift.ts` into your project and install its runtime dependency:

```sh
npm install @js-temporal/polyfill@0.5.1
```

This complete example uses `dayjs@1.11.23` and its built-in UTC/timezone plugins. Import paths below use the `.js` convention for a TypeScript project that emits ES modules.

```ts
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { shiftCalendar } from './calendar-shift.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const zone = 'Europe/London';
const start = dayjs.utc('2020-10-23T23:00:00.000Z').tz(zone);
const nextMs = shiftCalendar(start.valueOf(), 2, 'day', zone);
const next = dayjs.utc(nextMs).tz(zone);

console.log(next.toISOString()); // 2020-10-26T00:00:00.000Z
console.log(next.format('YYYY-MM-DD HH:mm:ss Z')); // 2020-10-26 00:00:00 +00:00
console.log((nextMs - start.valueOf()) / 3_600_000); // 49
```

The input is a known instant. Parse user-entered local dates separately with the ambiguity policy your application needs. The helper does not repair an input timestamp that was already calculated incorrectly.

The core returns epoch milliseconds and works without Day.js. It never changes a library prototype or reads private Day.js fields.

## API

```ts
shiftCalendar(epochMilliseconds, amount, unit, timeZone, options?)
```

| Argument | Meaning |
| --- | --- |
| `epochMilliseconds` | A finite safe integer Unix timestamp within Temporal's supported range |
| `amount` | A finite safe integer; negative values subtract |
| `unit` | Exactly `'day'`, `'week'`, `'month'` or `'year'` |
| `timeZone` | An explicit named zone such as `'America/New_York'`, or a Temporal offset identifier such as `'+05:30'` |
| `options.overflow` | `'constrain'` by default: January 31 plus a month becomes the final day of February. Choose `'reject'` to throw instead. |
| `options.disambiguation` | `'reject'` by default: throw if the target wall time is missing or repeated. Other policies are described below. |

The return value is a new epoch millisecond number. A zero amount preserves the input instant after argument validation, including either occurrence of a repeated time. The Day.js `.tz()` display example above uses a named zone; use the core result directly when working with numeric offset identifiers.

## Missing and repeated times

New York's `2024-03-10 02:30` never occurred; `2024-11-03 01:30` occurred twice. For a one-day shift into those times:

| Policy | Missing 02:30 in March | Repeated 01:30 in November |
| --- | --- | --- |
| `reject` (default) | Throws `RangeError` | Throws `RangeError` |
| `earlier` | 01:30 at UTC−05:00 | First occurrence, UTC−04:00 |
| `later` | 03:30 at UTC−04:00 | Second occurrence, UTC−05:00 |
| `compatible` | Same as `later` | Same as `earlier` |

Pass a policy explicitly when adjustment is appropriate:

```ts
import { shiftCalendar } from './calendar-shift.js';

const nextMs = shiftCalendar(
  Date.parse('2024-03-09T07:30:00.123Z'),
  1,
  'day',
  'America/New_York',
  { disambiguation: 'later' },
);
console.log(new Date(nextMs).toISOString()); // 2024-03-10T07:30:00.123Z
```

Calendar arithmetic differs from adding exactly 24 hours. It also differs from a recurrence engine: repeatedly using an adjusted result as the next input can move a schedule away from its original wall time. Month-end constraining and gap adjustment can make an addition followed by subtraction fail to recover the original instant.

## Why this exists

Day.js users report [calendar-day addition across DST](https://github.com/iamkun/dayjs/issues/1271) and [weekly recurrences with incorrect UTC output](https://github.com/iamkun/dayjs/issues/2624#issuecomment-2096821929). The first report's London example still reproduces with 1.11.23 in our Node 24.19.0 / ICU 78.3 checks: UTC, Santiago, New York and Shanghai hosts produce a result one hour early; a London host hides the failure. London's fall-back day in that example is **25 hours** long.

Existing suggestions in those discussions can help. Upstream proposals [#2961](https://github.com/iamkun/dayjs/pull/2961) and [#2962](https://github.com/iamkun/dayjs/pull/2962) also address calendar operations. This helper takes a separate approach using public Temporal APIs, explicit time zones and selectable ambiguity handling. It adds a dependency and does not claim to fix Day.js itself.

## Run the checks

Extract the ZIP and enter its `calendar-shift` directory. The fixture pins Day.js 1.11.23, Temporal polyfill 0.5.1 and TypeScript 5.9.3; checks were run with Node 24.19.0.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm test
```

The suite uses real packages, fixed UTC expectations and separate processes under five host time zones. It covers the original report, week/month/year shifts, negative and zero amounts, month-end rules, gaps and overlaps, Lord Howe's half-hour change, Apia's skipped date, offset zones, milliseconds and actual Day.js output.

```sh
npm run reproduce
```

This separate command runs the unmodified Day.js baseline under UTC and **intentionally fails its assertion** for the pinned version. It is evidence of the original discrepancy; `npm test` is the passing helper suite.

Time zone rules come from the runtime's `Intl` data through the [official Temporal polyfill](https://github.com/js-temporal/temporal-polyfill). Different or outdated databases can disagree, especially for future political changes. Browser and React Native runtime coverage is not claimed. See [Temporal's time-zone and ambiguity documentation](https://tc39.es/proposal-temporal/docs/zoneddatetime.html) for the underlying rules.

## License

[MIT](LICENSE). Use, modify and share the source, retaining the license notice. Small reproducible examples and corrections are welcome.

## Buy me a coffee, if this helped

This code is free. If it saved you some time and you'd like to buy me a coffee, a small contribution is entirely optional. Feedback is appreciated just as much.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
