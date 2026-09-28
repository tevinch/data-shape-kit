# Keep all counted recurrence dates when clock values repeat

In rrule 2.8.1, `COUNT=12;BYSECOND=0,30,0` can return only eight dates from a parsed recurrence set. Repeated candidate times consume the rule's count before the set removes duplicates. [Issue #671](https://github.com/jkbrzt/rrule/issues/671) contains the original `forceset: true` / `between` example.

The [source correction](https://github.com/tevinch/rrule/commit/938435d366cb0e0fbe81f56ca44d045edf2e03c5) removes repeated `BYHOUR`, `BYMINUTE` and `BYSECOND` values from internal options before iteration. The original arrays and serialized rule stay intact. The demonstrated query then returns all 12 dates through `09:05:30`.

## Use the correction

If you control the rule generator, emitting distinct clock values (`BYSECOND=0,30` here) avoids this failure with the official package. Do this before iteration: removing duplicates from the final returned dates cannot restore occurrences lost to `COUNT`.

For existing input that must retain its original serialization, a prebuilt package is available. **This is an unofficial build, not an upstream release.** It keeps the `rrule` package name and API, with version `2.8.1-clock-values.0`. Install the fixed download in a test project first:

```sh
npm install --ignore-scripts https://raw.githubusercontent.com/tevinch/data-shape-kit/recurrence-clock-values-v1/downloads/rrule-2.8.1-clock-values.0.tgz
```

Or [download the tarball](../../downloads/rrule-2.8.1-clock-values.0.tgz?raw=true) and run `npm install --ignore-scripts ./rrule-2.8.1-clock-values.0.tgz`. The package contains compiled CommonJS/UMD and ESM files, TypeScript declarations, original source, regression tests, build configuration and license. No library build is needed to use it.

Save [verify.cjs](verify.cjs) beside your project's `package.json`, then run `node verify.cjs`. It checks the original full query twice with each cache setting, exact ISO dates and unchanged serialization. Expected result: 12 dates, first `2008-01-01T09:00:00.000Z`, last `2008-01-01T09:05:30.000Z`. The script requires Node.js 18 or newer.

Your existing call remains:

```js
const { rrulestr } = require('rrule');
const set = rrulestr(
  'DTSTART:20080101T090000Z\nRRULE:FREQ=MINUTELY;COUNT=12;BYSECOND=0,30,0',
  { forceset: true }
);
const dates = set.between(
  new Date('2008-01-01T00:00:00Z'),
  new Date('2009-01-01T00:00:00Z'),
  true
);
console.log(dates.map(date => date.toISOString()));
```

## Verification and scope

The 10 added source regressions cover the original query with both cache modes, hour/minute/second selectors and their combination, frozen caller arrays, cloning and serialization, `RDATE`/`EXDATE`, an inclusive `UNTIL` boundary, and a `BYSETPOS=2` selection. Nine fail against the unchanged upstream source; the preservation control already passes. With the correction, the complete suite passes 391 tests with nine existing skips. Type checking, lint, formatting and the distribution build also pass on Node.js 18.20.4 / macOS.

The source is based on upstream commit `9f2061febeeb363d03352efe33d30c33073a0242`. Its manifest says 2.8.0; comparison with the published 2.8.1 package found all 28 compiled ESM JavaScript modules identical except this correction in `parseoptions.js`. See [verification.json](verification.json) for package checks and checksum. The original upstream README, author credits and BSD-3-Clause license are retained inside the tarball.

These are scripted software checks. There is no claim of independent adoption or human manual validation. The change does not address overlapping `BYSETPOS` selections ([separate PR #669](https://github.com/jkbrzt/rrule/pull/669)), existing unsorted selector ordering, time-zone/DST behavior or malformed input validation. Preserve rrule's documented UTC/floating-time conventions and check your application's schedules before rollout.

## Optional coffee

If this saves you some time and you'd like to buy me a coffee, thank you. It is entirely optional; the guide, package and source are free.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
