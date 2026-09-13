# Keep custom FullCalendar views usable with Spanish navigation hints

[FullCalendar issue #8100](https://github.com/fullcalendar/fullcalendar/issues/8100), reported by ex1st, describes a Spanish locale error when a custom view uses `duration: { month: 12 }`. The locale's hint callback can receive an undefined unit name. With the unmodified 7.1.0 package, the included reproduction fails during the first render with `toLocaleLowerCase`, before the toolbar appears.

This free example supplies three explicit hints through FullCalendar's public configuration. It keeps the original 12-month duration, Spanish labels, toolbar actions and event data.

## Copy the configuration

Add these three options to your existing calendar configuration:

```js
const calendar = new Calendar(calendarEl, {
  // Keep your existing plugins, locale, views, toolbar and events.
  todayHint: 'Ir a hoy',
  prevHint: 'Periodo anterior',
  nextHint: 'Periodo siguiente',
});

calendar.render();
```

The hints describe navigation without requiring a single-unit name. They remain meaningful for a custom 12-month period and the normal monthly view. They deliberately replace unit-specific phrases such as “Este mes” with general navigation text.

The example retains this view definition:

```js
views: {
  dayGridYear: {
    type: 'dayGrid',
    duration: { month: 12 },
  },
},
```

If your configuration already supplies `buttons.today.hint`, `buttons.prev.hint` or `buttons.next.hint`, update those too: per-button hints take precedence over the top-level options. These are Spanish strings, so an application that switches languages must supply the matching translations when its locale changes.

See the official [v7 locale and toolbar migration guide](https://fullcalendar.io/docs/upgrading-from-v6-js) for the current option names. This is a configuration workaround for the reported case, not an upstream package repair or a change to how custom durations are calculated.

## Run the complete example

[Download the v0.1.0 source](../../downloads/calendar-navigation-v0.1.0.zip?raw=true), extract it, and run:

```sh
npm ci --ignore-scripts
npm run demo
```

Use Node.js 24 or newer. Open the local URL printed by the server. The page starts in a 12-month view with one invented event. Use the calendar's previous, next, today and view buttons to navigate. Its “today” date is fixed to September 13, 2026 so the checks are repeatable; remove the demo's `now` option in your application to use the actual date.

The example uses only FullCalendar Standard and its Spanish locale. No Premium plugin or license key is needed. The dependencies are pinned to `fullcalendar` 7.1.0, esbuild 0.28.2 and Playwright 1.62.1.

## Verify the behavior

An installed Google Chrome is needed for the browser checks:

```sh
npm test
```

The test checks 12 states: initial render, two next/previous cycles, today, monthly-view navigation, return to the 12-month view, another next, and today again. It checks visible headings and accessible navigation hints, the actual displayed date ranges, the original duration and locale, and preservation of the event and Calendar instance.

To run the original configuration without the three hints:

```sh
npm run reproduce
```

On 7.1.0 this command is expected to exit nonzero because the original-render assertion catches the reported `toLocaleLowerCase` error. A setup or browser-launch error does not demonstrate the bug. You can also open the demo URL with `?original` to inspect that case.

Verified on September 13, 2026 with macOS 14.6, Node.js 24.19.0 and Google Chrome 152.0.7977.83. Other locales, browsers, framework connectors and custom hint callbacks were not tested. The source, test and guide are MIT-licensed; FullCalendar retains its own MIT license and notices in the installed dependency.

## Buy me a coffee, if this helped

If this saved you a little time, you're welcome to buy me a coffee. Please don't feel obliged — the example stays free.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please match the asset and network exactly. Thank you! — Tevinch
