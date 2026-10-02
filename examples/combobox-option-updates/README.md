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

These are scripted and software-operated checks, not human manual validation or confirmation from the reporter. Browser timing varies with the application and machine; the tests target repeated registration work rather than promise a fixed response time.

Headless UI is MIT licensed; see the [upstream license](https://github.com/tailwindlabs/headlessui/blob/main/LICENSE).

## Optional coffee

The source correction and guide are free. If they save you time and you'd like to buy me a coffee, thank you. It is entirely optional.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
