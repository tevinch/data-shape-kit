# Save Quill content after editing stops

Use Quill's `text-change` event to restart a five-second timer after a user edit. `quill.on('keyup', ...)` and `quill.on('keydown', ...)` do not subscribe to DOM keyboard events. Content changes also include toolbar formatting, paste and undo, so listening only for keyboard input misses some edits.

This small [module](idle-save.mjs) uses Quill 2's public APIs. It sends the complete current HTML after five seconds without a user change. While a save is pending, editing stays available. Saves run sequentially, and newer edits restart their own idle interval.

## Connect your save endpoint

Copy `idle-save.mjs` into your application. Initialize Quill and load the initial document before attaching the saver. Add a status element and a retry button:

```html
<p id="save-status" role="status">Ready</p>
<button id="save-now" type="button">Save now / retry</button>
```

```js
import { attachIdleSave } from './idle-save.mjs';

// `quill` is your initialized Quill 2 editor.
const status = document.querySelector('#save-status');
const saver = attachIdleSave(quill, {
  async save(html) {
    const response = await fetch('/documents/current', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html }),
    });
    if (!response.ok) throw new Error(`Save failed (${response.status})`);
  },
  onStatus(state, error) {
    const labels = {
      waiting: 'Changes waiting to save',
      saving: 'Saving…',
      saved: 'Saved',
      error: 'Save failed. Your changes are still in the editor. Retry when ready.',
    };
    status.textContent = labels[state];
    if (error) console.error(error);
  },
});

document.querySelector('#save-now').onclick = saver.saveNow;

// When removing/replacing this editor, call saver.dispose().
```

Replace `/documents/current` with your existing save endpoint and its required request fields. The endpoint must store the complete `html` value, including an empty document, and acknowledge only after the write finishes. `save` must return a promise that rejects on failure. Keep `onStatus` synchronous and non-throwing.

Only changes whose Quill source is `user` start the timer. Programmatic initialization does not schedule a save; `saveNow()` can explicitly save the current document. A pending user save reads the latest document when its request starts. Toolbar formatting and undo can therefore be saved without changing keyboard handling.

Failures do not erase the editor. Use the retry button or make another edit to try again. `dispose()` removes the listener and cancels waiting work; an already-started request may still finish. It does not flush unsaved content.

This example coordinates one editor instance. Keep your existing server-side handling of concurrent users, uncertain network failures and document versions. It does not add offline storage or guarantee a save when a tab closes. For editable Quill documents that need an exact format round trip, use Quill's Delta format in your own save contract instead of treating exported HTML as an exact editor-state backup.

## Verification

Run the module's tests with Node.js 22 or newer:

```sh
node --test test.mjs
```

The tests exercise idle timing, full snapshots, programmatic initialization, empty content, slow requests, failure/retry and disconnection. They model the editor's event/export boundary; they do not replace an actual browser check.

Browser checks with Quill 2.0.3 also saved a real keyboard edit through a local HTTP receiver after about five seconds. The receiver wrote the complete HTML and it was read back independently. Further checks covered a newer edit during an eight-second request, HTTP 503 followed by retry, toolbar bold formatting, two-line paste, undo, and saving an empty document. This verifies the example with a controlled receiver; the original question's database was not provided or tested.

Sources: [Quill text-change](https://quilljs.com/docs/api/#text-change), [HTML export](https://quilljs.com/docs/api/#getsemantichtml), and [the original question](https://github.com/slab/quill/issues/4834). This is an application example, not a change to Quill.

The module and tests are free under the repository's [MIT license](../../LICENSE).

## Optional coffee

If this saved you some time, a coffee is welcome. Please use the example freely either way.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
