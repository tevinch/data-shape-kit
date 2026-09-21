# Overlay parameter refresh

**Upstream status — 22 September 2026:** [Issue #15182](https://github.com/ag-grid/ag-grid/issues/15182) was closed after being entered into AG Grid’s backlog as **AG-18512**. The [official pipeline](https://www.ag-grid.com/pipeline/?searchQuery=AG-18512) currently schedules it for **36.3.0**; that is a plan, not a shipped fix. npm `latest` is 36.2.0. This patch remains restricted to 36.1.0; it has not been validated on 36.2.0 and must not be forced onto another version. Check the official changelog before upgrading or retiring it.

Update a custom AG Grid React overlay's text and actions while it is visible, using the existing `overlayComponentParams` option. This small patch is for **ag-grid-react 36.1.0**, with the default reactive custom components enabled.

[Download the example and patch](../../downloads/overlay-parameter-refresh-v0.1.0.zip?raw=true), or copy this directory. The code is free to use and adapt.

## What it fixes

In [AG Grid #15182](https://github.com/ag-grid/ag-grid/issues/15182), vaishal reported that parameter changes never reach an overlay registered through `overlayComponent` or `overlayComponentSelector`, and identified the missing wrapper mapping. A label stays stale; a conditional clear-filters action can stay hidden or retain an old callback. The legacy no-rows registration refreshes correctly.

The patch adds `overlayComponent` to the same React wrapper mapping as `noRowsOverlayComponent`. It preserves the new API, including the grid's `noMatchingRows` state. It does not change the component key, remount an overlay on parameter updates, or take over the grid's overlay timing.

[upstream.patch](upstream.patch) shows the one-line TypeScript source change. [apply-patch.mjs](apply-patch.mjs) makes the equivalent change in the published ESM and CommonJS files. This is an independent temporary patch, not an AG Grid release or an upstream pull request.

## Apply it in an application

1. Keep `ag-grid-react` and `ag-grid-community` pinned to `36.1.0`.
2. Copy `apply-patch.mjs` and `AG-GRID-LICENSE.txt` into your project.
3. After installing dependencies, run this command from the project root:

   ```sh
   node apply-patch.mjs
   ```

   If your package is elsewhere, pass its directory explicitly:

   ```sh
   node apply-patch.mjs ./path/to/ag-grid-react
   ```

4. Restart the development server or rebuild production assets. Clear an existing bundler dependency cache if it still serves the old code.

The script checks the package name, exact version and both full-file SHA-256 hashes before making a change. Repeating it is safe. Different versions, unrelated edits or missing files cause it to stop before writing either file. It updates only `dist/package/index.esm.mjs` and `dist/package/index.cjs.js`; UMD/CDN bundles are outside its scope. A write failure triggers an attempted rollback and reports if reinstalling is necessary.

Run it after every clean dependency install, or add it to your existing install/build procedure after reviewing the script. It does not add an install hook for you. To remove the patch, remove that command and reinstall clean dependencies from your lockfile. Reassess and remove it when an official release fixes the mapping; do not loosen the hash or version checks to apply it to a newer package. pnpm shared-store modifications and Yarn PnP installs have not been checked; use their supported dependency patch mechanism with the readable source change if needed.

Your overlay continues to use ordinary React props:

```jsx
function EmptyResult({ label, onClear }) {
  return <div><p>{label}</p><button onClick={onClear}>Clear filters</button></div>;
}

const selectOverlay = ({ overlayType }) =>
  overlayType === 'noMatchingRows' ? { component: EmptyResult } : undefined;

// Keep the component and selector identities stable. Update the params object.
<AgGridReact
  {...gridOptions}
  ref={gridRef}
  overlayComponentSelector={selectOverlay}
  overlayComponentParams={{ label, onClear: () => gridRef.current.api.setFilterModel(null) }}
/>
```

The [provided-overlay documentation](https://www.ag-grid.com/react-data-grid/overlays-provided/) explains the grid-owned states and selector fallback. This fixture customizes `noRows` and `noMatchingRows`; its selector leaves loading to the provided overlay.

## Run the example and checks

Use Node.js **22.12+** and an installed Chrome/Chromium executable. From this directory:

```sh
npm ci --ignore-scripts --no-audit --no-fund
# Point to your own Chrome/Chromium executable. This macOS path is one example.
export PUPPETEER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
npm run verify -- --original
npm run patch
npm run test:patch
npm run verify
npm run dev
```

`--ignore-scripts` skips Puppeteer's browser download; the explicit executable path is needed. The checks launch a fresh browser profile. `verify` builds both production formats, serves each on a local temporary port, exercises the visible controls, then closes its servers. Reports and screenshots go to `.checks/`. The `--original` command expects the four new-API scenarios to fail on the stale-label assertion and the legacy comparison to pass **in each format**; it exits successfully only when that exact reproduction is observed. It never changes installed files.

The example has selector, direct and legacy modes. Use **Load rows**, **Filter to Plum**, **Update parameters**, then **Toggle overlay action** and **Clear filters**. The two original rows should return. Type an unfinished note before updating parameters to check that it remains intact. A grid-state transition that closes an overlay naturally unmounts it; note persistence is checked while the same overlay remains visible.

Verified on 2026-09-13 with AG Grid Community/React 36.1.0, React/ReactDOM 19.3.0, Vite 8.2.2, Puppeteer 25.9.0 and Chrome 152.0.7977.83 on macOS. The original packages failed all eight new-API scenarios across the two formats; both legacy comparisons passed. After the patch, all ten scenarios passed.

Checks cover repeated label changes, action visibility, replacement callbacks while a button remains visible, unsaved local notes, loading precedence, empty/load transitions, two no-match/clear cycles, exact row values in the grid model and rendered cells, and empty filter state after clearing. Patch checks also cover repeat application and refusal of a different version, edited file or missing file. These are scripted production-browser checks. Other browsers, non-reactive custom components, Enterprise overlays, server rendering and the complete upstream test suite have not been tested. Vite reports a large-chunk warning because the demo includes all Community modules.

## License

[MIT](LICENSE) for the example and patch helper. The AG Grid source change retains [AG GRID LTD's MIT license](AG-GRID-LICENSE.txt). Thanks to vaishal for the report and proposed missing case.

## Optional coffee

This example is free. If it saves you some time and you'd like to buy me a coffee, thank you. There's no obligation; useful feedback is welcome too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
