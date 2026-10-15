# Canvas load recovery

A small Fabric.js 7.4.0 application example for an editor that must recover from a failed or cancelled `loadFromJSON`, retry on the same canvas, and keep editing. This is a reviewable proposed recipe, not an official documentation change or a claim that the upstream issue is resolved. It uses the existing API and makes no changes to Fabric.

## Run

Download the [standalone example ZIP](https://github.com/tevinch/data-shape-kit/raw/refs/heads/main/downloads/canvas-load-recovery-v1.zip), extract it, and open a terminal in its `canvas-load-recovery` directory.

Use Node.js 20 or newer and an installed Google Chrome:

```sh
npm ci --ignore-scripts --omit=optional
npm start
```

Open the printed localhost URL. Try **Load missing image**, **Load unknown class**, or **Load pending image → Cancel load**. The existing red square stays visible for these fixtures. Then choose **Load valid document**, add and remove the blue square, and try with automatic rendering off. The local server deliberately holds the pending image until cancellation; it serves no external assets.

## The recipe

[`load-document.js`](./load-document.js) is the complete application helper used by the demo and tests. Copy it into your own application, rather than installing another library.

```js
import { loadDocument } from './load-document.js';

const controller = new AbortController();
const result = await loadDocument(canvas, savedDocument, controller.signal);
if (result.status === 'failed') {
  // Show result.error and let the user retry or reopen a known-good document.
}
// A cancel button can call controller.abort() while the promise is pending.
```

The helper awaits `loadFromJSON`, requests a render only after success, catches rejection/cancellation, and restores the original `renderOnAddRemove` in `finally`. An explicit `false` stays `false`; call `requestRenderAll()` after subsequent edits when your application uses that setting.

In 7.4.0, a failed top-level image can be omitted while the default call resolves. The helper's reviver throws the reported error so that this particular case rejects instead. A default call that resolves is therefore not proof that every asset loaded.

Run only one load per canvas. Pause editing and other document controls while it runs. To replace an active load, abort it **and await its result** before starting the next one; aborting alone is not a sequencing mechanism. The demo disables competing controls until the current promise settles. Do not change the rendering setting while a load owns it.

## What remains on the canvas

For the supplied built-in-object fixtures, an unknown class, a rejected top-level image, and an in-flight abort happen before Fabric clears and replaces the document. Tests check that the old object identity, serialized properties, background and visible pixels remain, then verify a successful replacement and further edits.

This is **not a transaction or rollback guarantee**. The top-level reviver does not cover every nested asset: this release can still omit an image inside a group or a canvas background image and resolve. The tests demonstrate that boundary. Validate the result your application needs; a resolved promise alone cannot establish document completeness. This example does not implement recursive asset validation.

Custom classes, reviver side effects, application event handlers or errors during the clear/add/set commit can change existing state. A `finally` block restores the rendering preference; it cannot undo those changes. Keep an application-owned last-known-good document, avoid mutating the live document from revival callbacks, and define a separate reopen/recovery path for commit-time failures. Do not assume that saving the current canvas after an error recovers the previous document. Overlapping loads and custom recovery logic are outside this example's verified scope.

The source-level restoration defect already has [Fabric PR #11161](https://github.com/fabricjs/fabric.js/pull/11161), including a [linked CodeSandbox preview](https://codesandbox.io/p/devtool/preview/mrityunjay-pandey/fabric.js/fix/load-from-json-render-on-add-remove?task=preview&port=51423&redirect=true&utm_source=gh_app). That preview has not been validated here. This example targets the pinned 7.4.0 release and the separate [request for failure/cancellation guidance](https://github.com/fabricjs/fabric.js/issues/11131). See also the official [`loadFromJSON` API](https://fabricjs.com/api/classes/staticcanvas/#loadfromjson). Recheck release behavior before adapting it to another version.

## Checks

```sh
npm test
# Other Chrome installations:
CHROME_PATH=/path/to/chrome npm test
# Negative control against the unguarded release call; expected to fail:
npm test -- --baseline
```

The checks use an isolated headless Chrome session and real canvas pixels, with network requests restricted to the local fixtures. They cover both rendering settings, an actual HTTP 404, an image observed in flight before abort, preserved content before commit, retry and continued add/remove rendering, plus default and nested/background omissions. They also assert that the error reviver was actually called. These are scripted browser checks, not human or original-reporter validation. No browser download or optional native canvas dependency is required.

The final example passed all eight checks after a clean install with Node.js 24.19.0 and Chrome 155.0.8059.41. The example code and guide use the [MIT license](LICENSE); Fabric and Playwright retain their own licenses.

## Optional coffee

The source and guide are free. If they saved you time and you would like to buy me a coffee, a small contribution is entirely optional:

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
