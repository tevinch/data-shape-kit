# Faster option updates in Headless UI Combobox

Filtering a large ordinary Combobox in Headless UI React 2.2.10 can repeatedly sort its options and notify every subscriber for each mounted or removed item. [Issue #3898](https://github.com/tailwindlabs/headlessui/issues/3898) reports the resulting typing delay with 1,000 rendered options.

The proposed source correction combines option changes into one batch and preserves synchronous navigation, selection and focus behavior. It keeps the ordinary rendering mode and the application's option count. Headless UI also has a [documented virtual mode](https://headlessui.com/react/combobox#virtual-scrolling) if that already fits your application.

## Build and try the correction

The [source PR #3899](https://github.com/tailwindlabs/headlessui/pull/3899) is under review and has not shipped in an official release. Review the [fixed commit](https://github.com/tevinch/headlessui/commit/62be2bdc0f1393295f9185c11d1e9da599286c57), then build it in a separate checkout. These commands use the repository lockfile; Node.js 24.19.0 was used for verification.

```sh
git clone --single-branch --branch fix-combobox-option-batching https://github.com/tevinch/headlessui.git
cd headlessui
git checkout 62be2bdc0f1393295f9185c11d1e9da599286c57
npm ci --ignore-scripts --workspace=@headlessui/react --workspace=@headlessui/vue --workspace=@headlessui/tailwindcss --include-workspace-root
npm run build
cd packages/@headlessui-react
npm pack --ignore-scripts
```

Install the resulting `headlessui-react-2.2.10.tgz` in a test branch of your application:

```sh
npm install --ignore-scripts /absolute/path/to/headlessui-react-2.2.10.tgz
```

Keep your React version, existing Combobox props and candidate data. The local archive retains the upstream package name and version; keep the archive with the lockfile entry and return to an official release once the correction ships.

## Verify the complete interaction

Open the list, type a query, navigate past disabled options and select with Enter. Reopen it and confirm the selected item. Search for something absent, clear the input, then select another item with the pointer. Repeat with your own `multiple`, `static`, explicit ordering or virtual configuration. Clearing a single-value input retains Headless UI's existing behavior of clearing its selected value.

Checks on 2026-10-02:

- The registration regression originally performed 4,096 selector evaluations for 64 options. The correction passes a bound of four evaluations per subscriber while retaining selection and navigation.
- All 56 test suites pass: 2,052 tests, 100 snapshots and 36 skipped tests. An earlier run hit an unchanged Vue transition timing snapshot; both the isolated file and the final complete run pass without changes.
- React/Vue builds, formatting and a direct type-resolution check of the packed React package pass. Regressions include immediate focus followed by Tab and switching to virtual options under StrictMode.
- Software-operated Chrome checks with React 19.3.0 complete repeated filtering and selection with 1,000 ordinary options, plus static, ordered, multiple and virtual flows. The packed archive installs in a separate consumer and completes keyboard input, empty-result recovery and pointer selection.

These are scripted and software-operated checks, not human manual validation or confirmation from the reporter.

## Repeated timing comparison

The reporter requested before/after measurements in the PR. On 2026-10-03, the same production fixture was run with npm 2.2.10 and the packed correction above. Each row below shows the median of five fresh-page trials after one warm-up, with the minimum and maximum in parentheses, in milliseconds:

| Rendered options | npm 2.2.10 | Packed correction |
| ---: | ---: | ---: |
| 250 | 901.8 (862.9–1074.3) | 55.1 (50.0–67.0) |
| 500 | 4604.4 (3412.5–5102.0) | 175.2 (148.3–213.6) |
| 1000 | 22411.7 (20248.1–23185.6) | 580.0 (534.8–754.5) |

Environment: Apple M1, macOS 14.6, headed Chrome 154.0.8037.93, React 19.3.0, production bundles. No CPU throttling was configured. The browser controller and existing extensions were present, so these absolute times are not directly comparable with the reporter's Linux results. This is evidence for this fixture on one machine, not a universal speedup claim.

The metric starts in a capture-phase `input` listener and ends in the next `requestAnimationFrame` callback. It excludes initial opening and does **not** measure completed paint or INP. Each trial opens the list, selects the input contents and presses `1`, filtering 10,000 candidate strings to the stated option limit. The ordinary rendering path, disabled values and selected value are unchanged. All 30 measured trials recorded one trusted input event, the full requested option count before and after, and the original selected value. Slow baseline operations sometimes exceeded the browser controller's response deadline; their completed page results were read afterward without sending the input again. No timed sample was discarded. Baseline and correction were run in alternating order.

[All samples and warm-ups](benchmark/results.json) and the [fixture source](benchmark/main.jsx) are included. This fixture has the same filtering operation but is independent of the reporter's reproduction.

To reproduce, first build and install the correction in a separate consumer as described above. Then enter `benchmark`:

```sh
npm ci --ignore-scripts
node build.mjs baseline
node build.mjs packaged /absolute/path/to/consumer/node_modules/@headlessui/react
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/baseline.html?count=1000` and `http://127.0.0.1:8765/packaged.html?count=1000` in turn. Click **Show options**, focus the input, select its contents and type `1`. Read `durationMs` in the Metrics block. Reload for each trial; repeat at `count=250` and `count=500`, discarding only the first warm-up for each combination. Keep the browser, window, extensions and other workload consistent. Use your own application and supported browsers to establish production performance.

Headless UI is MIT licensed; see the [upstream license](https://github.com/tailwindlabs/headlessui/blob/main/LICENSE).

## Optional coffee

The source correction and guide are free. If they save you time and you'd like to buy me a coffee, thank you. It is entirely optional.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
