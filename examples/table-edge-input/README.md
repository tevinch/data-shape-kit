# Keep a table when replacing text selected from its left edge

Dragging backward from the first cell into the margin can select the table's opening boundary as well as the text. In TinyMCE 8.9.2, typing over that range can remove the entire table. This example reproduces [TinyMCE #11252](https://github.com/tinymce/tinymce/issues/11252) and provides a small public-API workaround.

For a three-cell row containing `Test`, drag from the end of the word past the table's left border, then type `s`. With the guard enabled, the row and all three cells remain, with `s` in the first cell. Selecting just the word does not need this workaround.

## Use in your editor

Copy [table-edge-input.js](table-edge-input.js) into your application and register it on each initialized editor:

```js
import {registerTableEdgeInput} from './table-edge-input.js';

// Add to your existing TinyMCE setup; retain your other settings and handlers.
setup(editor) {
  editor.on('init', () => {
    registerTableEdgeInput(editor);
  });
}
```

Registration returns a disposer if you need to disable it before removing the editor:

```js
const dispose = registerTableEdgeInput(initializedEditor);
// Later:
dispose();
```

Register once per editor. The listener also removes itself when the editor is removed. The module has no imports and uses the application's existing TinyMCE instance.

The guard listens to the documented [beforeinput event](https://www.tiny.cloud/docs/tinymce/latest/events/) and uses [selection.setRng](https://www.tiny.cloud/docs/tinymce/latest/apis/tinymce.dom.selection/#setRng) to move the start of this specific range inside the first cell. It neither writes document content nor cancels insertion. TinyMCE and the browser perform the typed replacement and manage undo.

## Run the example

Download [the complete source ZIP](../../downloads/table-edge-input-source.zip?raw=true), or use this directory from the repository. With Node.js 20 or newer:

```sh
npm ci --ignore-scripts
npm run check
npm start
```

Open `http://127.0.0.1:8773`. The server listens only on the local interface and serves the pinned TinyMCE 8.9.2 assets from the installed package.

1. Drag backward from the end of `Test` into the left margin, then type a letter. **Select from table edge** prepares the same range without requiring a precise drag.
2. Repeat the replacement, then use Undo and Redo. **Guard: off** lets you compare the original behavior after resetting.
3. Try **Read only**: typing must leave the document unchanged. **Reset example** deliberately restores a fresh editable fixture and history.
4. Run **Run browser checks** in both Iframe and Inline modes. Results, event counts and the current document appear below the editor. In Inline mode, click the page heading to hide the floating toolbar if it covers a control.

## Scope and verification

The supported range starts immediately before a table and ends inside its first cell, which must be first in both document order and table row order. It applies only to uncancelled, nonempty `insertText` outside composition, in an editable editor and selection.

The guard declines whole-table or multi-cell selections, captions, nested tables, selected content before the table, protected content in the first cell, read-only state, composition, paste and deletion events. Those operations retain their existing behavior; they are not repaired by this example. If an earlier host listener cancels the event, the range is left alone. A later cancellation still prevents insertion through the normal event handling.

The recorded Chrome 152/macOS run passed 24 scripted checks in each of the iframe and inline editors. They dispatch cancellable `beforeinput` events, perform text insertion in the real editor, and independently count the required callbacks and resulting input events. They cover nonempty neighbouring cells, partial-prefix replacement, text within formatting, header cells, surrounding paragraphs, repeated replacement, history, cancellation, protected content and disposal. Delegation checks verify unchanged selection and document without performing the delegated operation. The composition check uses an event flag; it is not an IME typing test.

Separate software-operated native pointer and keyboard checks verified the original backward margin drag in iframe mode, native typing in both modes, repeated replacement, undo/redo and read-only input. See [verification.json](verification.json) for exact results. Windows, Firefox, Safari, human manual validation and reporter adoption have not been verified. Recheck your editor configuration and browser before adopting, and remove the workaround when an upstream release covers the issue.

The original example code is MIT licensed; see [LICENSE](LICENSE). TinyMCE is installed separately and retains its own GPLv2-or-later or commercial licensing. This demo uses TinyMCE's `license_key: 'gpl'` setting; copying the guard does not change your application's TinyMCE license.

## Optional coffee

If this saves you some time and you'd like to buy me a coffee, thank you. It is entirely optional; the source and example are free.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
