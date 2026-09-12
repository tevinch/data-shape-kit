# React Aria keyboard drag cleanup

This exact-version patch ends a keyboard drag when its source item unmounts. It addresses the stuck drag session demonstrated in [react-spectrum issue #10599](https://github.com/adobe/react-spectrum/issues/10599): collapsing the source branch can otherwise leave the page inert, move focus to `body`, swallow keyboard input, and emit another cancellation when Escape is pressed.

The recipe pins `react-aria-components` 1.21.1, `react-aria` 3.52.1, `react-stately` 3.50.0, React and ReactDOM 19.2.8. Build and test dependencies are pinned in `package-lock.json`; Node.js 24 or newer is required for the included Vite 8 toolchain.

## Run the reproduction and checks

From this directory:

```sh
npm ci --ignore-scripts
npx playwright install chromium firefox
npm run reproduce
npm test
# Optional focused development lifecycle check:
npm run test:strict-mode
```

`npm run reproduce` intentionally exits nonzero. Against the pristine published package it records three remaining inert nodes, `BODY` focus, rejected input, and two drag-end events after Escape. `npm test` applies the patch only to a temporary package copy, runs the production format matrix and a development StrictMode check, and leaves the installed control unchanged. `npm run test:strict-mode` runs only that development lifecycle check.

To apply the patch explicitly to this example and open the interactive fixture:

```sh
node apply-patch.mjs .
npm run dev
```

Open the printed `/fixture/index.html` URL. Start a keyboard drag from a **Move** button with Enter, navigate among drop targets with the arrow keys, and collapse a branch with its direction-aware left or right arrow. The controls also cover direct source removal, whole-tree unmount, and synchronous removal during a successful move.

## Apply it to a compatible application

First confirm that the application has an ordinary, non-symlinked root installation of the exact package:

```sh
npm ls react-aria react-aria-components react-stately react react-dom
node /path/to/keyboard-drag-cleanup/apply-patch.mjs /path/to/application
```

The applicator verifies `react-aria` 3.52.1 and the SHA-256 hash of every target before writing anything. It applies all six changes together, recognizes an already-patched installation, and rejects an altered, mixed, or differently versioned package without changing it. It patches the `.mjs`, `.js` legacy-module, and `.cjs` builds of `DragManager` and `useDrag`; the verification suite resolves and builds each format separately.

Package managers replace edits inside `node_modules`. Reapply after an install that restores the exact supported bytes. To roll back, reinstall from the unchanged lockfile:

```sh
npm ci --ignore-scripts
```

In another application, restore its lockfile and reinstall `react-aria` 3.52.1. Do not apply this patch to another release. Recheck the upstream implementation and regenerate both the patch and hash manifest for any upgrade.

## Behavior

Unmounting the active source now ends the session once with the `cancel` operation. Cleanup removes drop indicators and inert state, then restores focus to a still-connected usable control: the source when it survives, otherwise a surviving target or collection, an already-focused outside element, or the first usable page control. A requestAnimationFrame check handles focus changes that settle after React's unmount work.

Cancellation does not retain or resume the interrupted move. The user starts a new move after the source or branch returns. Collapsing an unrelated branch leaves the active drag available. A normal Escape still cancels once and focuses the source.

Successful drops keep their original result. If an application's `onMove` or drop callback synchronously moves or removes the source, the unmount cleanup does not race the in-progress drop: the session ends exactly once with `move` rather than `cancel`.

## Implementation and maintenance limits

The patch is based on Adobe's published `react-aria` 3.52.1 runtime files and the corresponding [`DragManager.ts`](https://github.com/adobe/react-spectrum/blob/4dd44e0f400636a87a9ad4390903e78c5ae6113c/packages/react-aria/src/dnd/DragManager.ts) and [`useDrag.ts`](https://github.com/adobe/react-spectrum/blob/4dd44e0f400636a87a9ad4390903e78c5ae6113c/packages/react-aria/src/dnd/useDrag.ts) sources. It is an independent compatibility recipe, not an official React Aria release or an accepted upstream fix.

The modified generated runtime files carry a Tevinch modification notice and omit their now-invalid source-map references. `UPSTREAM-LICENSE` reproduces the Apache License 2.0 shipped in the npm tarball. The tarball contains no `NOTICE` file. `original-hashes.json` records the expected pristine and patched bytes.

The browser suite uses real keyboard interaction in Chromium 153.0.8010.12 and Firefox 155.0 on macOS arm64. Its production builds cover LTR and RTL source-ancestor collapse, direct source removal, unrelated collapse, whole-widget unmount, normal Escape, a new drag after cancellation, ordinary tree mount cycles, and successful synchronous source removal. A separate Vite development-server run observes StrictMode's effect counters at two setups and one cleanup on initial mount, then verifies active-drag cancellation, remount replay without a false drag-end, and another usable drag. It does not exercise pointer drag, touch drag, native assistive technology, or screen-reader output.

## License

The fixture, applicator, tests, and other original recipe files are [MIT licensed](LICENSE). The patch is derived from Adobe's Apache-2.0-licensed React Aria files and remains subject to the included [upstream license](UPSTREAM-LICENSE). Retain both licenses and the notices in every modified upstream file when redistributing the recipe.

If this free recipe saves you time, you can optionally buy me a coffee:

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
