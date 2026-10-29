# Keep selections after Alpine page updates

Alpine 3.17.4 can lose an `x-modelable` change made immediately after a Morph update. Repeated morphs also leave extra bindings behind. [Issue #4928](https://github.com/alpinejs/alpine/issues/4928) includes a small counter reproduction and describes selected rows being lost after pagination.

The [source correction](source.patch) wraps the `modelable` directive in Alpine's existing `skipDuringClone` helper. The check runs before its microtask is queued, so a discarded comparison node cannot establish a live entanglement later. Ordinary inserted components still initialize normally.

This is a proposed correction, not an official release. It has been verified with standalone Alpine and Morph. The original reporter's Livewire application has not been tested.

On October 14, a matching upstream correction was submitted in [PR #4929](https://github.com/alpinejs/alpine/pull/4929). It was closed without merging on October 29. The current official npm release is 3.17.5, whose `x-modelable` source does not include this clone guard. This example and its recorded checks remain pinned to 3.17.4; it has not been rerun against 3.17.5.

## Run the example

Use Node.js 24 or later and an installed Chrome browser. From this directory:

```sh
npm ci --ignore-scripts
npm run build
npm test
python3 -m http.server 8765 --bind 127.0.0.1
```

Open [the local example](http://127.0.0.1:8765/). Select a page, edit the notes, then move through several pages. Uncheck and recheck a row. Turn off **Select new pages**, move again and select a row yourself. The selection, notes and setting should remain intact. **Toggle list** removes and recreates the component to check a fresh binding.

The build copies the pinned npm source to `.build`, checks its version and source hash, applies the same three-line correction and creates `dist/alpine.js` and `dist/alpine.esm.js`. Installed packages remain unchanged. The CDN-style file starts Alpine automatically; the ESM file exports Alpine for your own initialization. These are local builds of 3.17.4, labeled `3.17.4-local-modelable`.

For a standalone Alpine application, use the corrected build in place of its existing Alpine import and keep its Morph plugin. Check your own settings and supported browsers before adopting it. Return to the official package when a release includes the correction.

Livewire bundles its own Alpine instance. Adding this standalone build alongside Livewire would load Alpine twice. The [Livewire installation guidance](https://livewire.laravel.com/docs/4.x/installation#manually-bundling-livewire-and-alpine) explains its bundling model; the source correction needs to reach that bundled instance. This example is not a drop-in Livewire installation procedure.

## Source contribution

From an Alpine source checkout, apply the readable patch and copy the proposed regression file into its test directory:

```sh
git apply /path/to/alpine-modelable-state/source.patch
cp /path/to/alpine-modelable-state/x-modelable-morph.spec.js tests/cypress/integration/directives/
npm ci --ignore-scripts
npm run build
npx cypress install
npx cypress run --browser chrome --spec 'tests/cypress/integration/directives/x-modelable*.spec.js'
npx vitest run
```

The source correction was checked against Alpine main commit `8d3d9a2f98385d4c879f4b5be080a0221279ed4d` and the identical directive in npm 3.17.4. The patch changes source rather than matching generated or minified runtime text.

## Verification

Checks on 2026-10-14, Node.js 24.19.0 and Chrome 155.0.8059.40:

- Both npm 3.17.4 and the unchanged main build reproduce the lost immediate update, lost page selection and growing binding work, without browser errors.
- The corrected build passes all 12 Playwright cases: three new regressions and nine existing `x-modelable` fixtures. The existing fixtures cover ordinary bindings, `x-bind`, event-listener removal, debounce/throttle, teleport and removed-element cleanup.
- The pagination flow performs 11 real attribute-observer callbacks, checks every selected ID, retains notes and focus, respects disabled automatic selection, and continues working after removal and recreation.
- A nested-array update reads the model twice after 0, 1, 5, 10 and 20 morphs with the correction; the original reads it 2, 4, 12, 22 and 42 times. This measures the supplied fixture's work, not heap usage or a general performance guarantee.
- The upstream package build succeeds. Its Vitest suite passes 204 tests, with one skipped, before and after the source correction.

`npm test` expects the three known regressions to fail in the stable build and all checks to pass in the corrected build. It writes `browser-stable.json` and `browser-fixed.json` with the results. Unexpected browser errors or different failures fail the command.

The official Cypress suite has **not** been run here: its browser package download was too slow to complete. The included Cypress file is a proposed regression test; the executed browser checks use Playwright and the same fixtures. These are software-operated Chrome checks, not human manual validation, Firefox/WebKit coverage, or confirmation of adoption by the reporter.

The upstream PR's [CI run](https://github.com/alpinejs/alpine/actions/runs/38548196926/job/115799398912) successfully executed its build, Cypress and Vitest commands. Separately, source reconstructed from its unchanged base and exact commit `d2a24b65cc47addc652a553e56e131dffaedeaee` passed the same 12 Playwright checks in Chrome 155.0.8059.41. All 67 Alpine and Morph source/build-entry files were checked against the published Git blob hashes before compilation. The original npm build still reproduced the three known failures. This adds standalone pagination, settings and existing-content coverage; it does not establish that the original Livewire application has been fixed.

Alpine source and the existing fixtures are MIT licensed; see [the upstream license](LICENSE.alpinejs.md). The example and correction are free under this repository's MIT license.

## Optional coffee

The source correction, example and checks are free. If they save you time and you'd like to buy me a coffee, thank you. It is entirely optional.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
