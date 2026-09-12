# Keep FullCalendar time-grid lanes stable when hours change

[FullCalendar issue #8101](https://github.com/fullcalendar/fullcalendar/issues/8101) reports time-grid labels retaining text while their measured width becomes zero after a phase-changing `slotMinTime` update. This free example uses one official configuration workaround: set the header interval explicitly to the slot duration before the first render.

## Copy the configuration

Add these options to the calendar's initial configuration, before calling `render()`:

```js
const calendar = new Calendar(calendarEl, {
  slotDuration: '00:15',
  slotHeaderInterval: '00:15',
  slotMinHeight: 40,
  // Keep the rest of your calendar options here.
});

calendar.render();
```

The key is to set [`slotHeaderInterval`](https://fullcalendar.io/docs/slotHeaderInterval) and [`slotDuration`](https://fullcalendar.io/docs/slotDuration) to the same value in the initial configuration. This makes labels more frequent: a 15-minute grid gets a label every 15 minutes instead of FullCalendar choosing a sparser interval. The explicit 40-pixel minimum keeps each lane usable in this example.

After rendering, change the hours through the public API without destroying or recreating the calendar:

```js
calendar.setOption('slotMinTime', '08:00');
calendar.setOption('slotMaxTime', '18:00');
```

This is a configuration workaround for calendars set up before their first render. It is not a recovery procedure for an instance that has already collapsed.

## Run the example

[Download the v0.1.0 source](../../downloads/calendar-hours-v0.1.0.zip?raw=true), extract it, and run the following commands from the extracted directory. Node.js 24 and an installed Google Chrome are required.

```sh
npm ci --ignore-scripts
npm run demo
```

Open the local URL printed in the terminal. The default page uses the Standard `timeGridDay` view. Add `?resource=1` to that URL for the separate `resourceTimeGridDay` evaluation. Both use one invented room and booking. The controls call `setOption` for the opening and closing times without remounting the calendar.

Run the browser regression tests with:

```sh
npm test
```

The tests use Playwright's installed-Chrome channel and cover both views through the sequence 05:45 → 06:00 → 08:00 → 04:30 → 08:00, followed by a closing-time change. They check the mounted labels and lanes, visible booking dimensions, browser errors, and preservation of the active date, view and event data.

To demonstrate the original configuration without `slotHeaderInterval`, run:

```sh
npm run reproduce
```

That command is expected to exit nonzero because its positive-width assertion catches the collapsed label axis. A setup or browser error is a different failure and is not a valid reproduction.

Verification on September 13, 2026 used macOS 14.6, Node.js 24.19.0 and Google Chrome 152.0.7977.83. Other browsers, operating systems, framework adapters and layouts were not tested.

## Dependencies and scope

The example pins `fullcalendar` 7.1.0, `fullcalendar-scheduler` 7.1.0, esbuild 0.28.2 and Playwright 1.62.1. It uses their public APIs and official plugins without modifying or vendoring dependency code. It does not patch FullCalendar internals, coerce DOM dimensions, or claim to fix the upstream implementation.

The Standard view is the default, and the resource view is provided for evaluation. Both demo modes load the unmodified Premium resource and scroll-grid plugins and deliberately leave the Scheduler license key unset, so both show the package's own license warning. FullCalendar Premium has [separate licensing terms](https://fullcalendar.io/docs/premium); using its plugins in a production application requires following those terms. The MIT license in this directory covers the original example code and guide, not the unmodified FullCalendar dependencies.

## Buy me a coffee, if this helped

If this saved you a little time, you're welcome to buy me a coffee. Please don't feel obliged — the solution stays free, and a useful reproduction is appreciated too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please match the asset and network exactly. Fees depend on your wallet or exchange. Thank you! — Tevinch
