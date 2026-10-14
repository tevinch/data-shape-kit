# Month calendar lifecycle

FullCalendar 7.1.2 month-event dragging can fail after React 18 development StrictMode replays component mounts. This example includes a small shared-source correction and a locally built React package. Dragging, resizing, selecting dates, adding events and deleting events continue with StrictMode enabled.

The correction retains the row element across lifecycle replay and reconnects its height watcher on mount. Initial ref measurement stays in place, height reconnection does not repeat external root refs, and real detachment/unmount still clears the subscription. It changes one shared Preact source file; FullCalendar's own build generates the React source. See [source.patch](source.patch) and the [original report](https://github.com/fullcalendar/fullcalendar/issues/8119).

## Run the example

Use Node 24.19.0 and an installed Google Chrome for the browser checks.

```sh
npm ci --ignore-scripts
npm run build
npm start
```

Open http://127.0.0.1:4173. Move the all-day event, resize its end, then move it again. Select empty dates and enter a title to add an event; click an event and confirm to delete it. The sidebar follows the actual calendar events. Controls demonstrate weekends, container width, editing permissions and a blocked date. Crowded-day and print-layout controls exercise overflow and FullCalendar's layout entry points.

The example pins React/React DOM 18.3.1, FullCalendar 7.1.2 and Temporal polyfill 1.0.1. `package-lock.json` includes the integrity of the local archive at [vendor/fullcalendar-react-7.1.2-row-lifecycle.tgz](vendor/fullcalendar-react-7.1.2-row-lifecycle.tgz). The archive is an unofficial build containing this source correction; it is not an upstream release. Copy the archive into your project and install it with `npm install ./fullcalendar-react-7.1.2-row-lifecycle.tgz`. Keep your existing calendar options and content. Review and test against your own application before updating its dependency lock.

## Verify

```sh
npm test
npm run test:stable
```

`npm test` uses actual Playwright pointer input in Chrome. It checks API dates, rendered event positions, sidebar content, independent drop/resize/permission callback counts, all six measured month rows, subscription sequences and real unmount cleanup. It covers same-week, cross-week and repeated moves; resizing; navigation, views, weekends and width changes; rejected and subsequent permitted moves; prompt-based creation, dragging and confirmed deletion; TimeGrid all-day dragging/resizing; overflow and print-layout entry followed by continued editing. The print check invokes FullCalendar's `_beforeprint`/`_afterprint` layout entry points; it does not test a native print dialog.

`npm run test:stable` substitutes the unchanged official 7.1.2 package and **is expected to fail** the first StrictMode drop. The ordinary mounting control still passes. Reports and screenshots are written to `test-results/`. Both official 7.1.1 and 7.1.2 reproduced the original failure with React 18.3.1 in Chrome 155.0.8059.41. Rebuilding after removing the source correction reproduced that failure; restoring it passed the complete sequence.

The [source regression](upstream-tests/daygrid-row-lifecycle.test.ts) checks single registration, replay reconnection, current height refs, real detachment and synchronous ref-before-mount acquisition. [SOURCE-BUILD.md](SOURCE-BUILD.md) explains how to rebuild and run it. FullCalendar's existing React tests (26), Preact tests (68), headless tests (75), React typecheck and targeted React/Preact builds also passed. Browser results are software-operated Chrome checks; other browsers and application-specific configurations need their own checks.

## License

The example is [MIT licensed](LICENSE). FullCalendar retains Adam Shaw's [MIT license](FULLCALENDAR-LICENSE.md), also included in the built package. Keep both notices when redistributing the example, patch or package.

## Buy me a coffee, if this helped

This code is free. If it saved you some time and you'd like to buy me a coffee, a small contribution is entirely optional. Feedback is appreciated just as much.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
