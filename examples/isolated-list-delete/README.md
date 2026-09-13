# Keep list Delete inside an isolating frame

`IsolatedListDelete` is a small Tiptap extension for the forward Delete behavior in [issue #8321](https://github.com/ueberdosis/tiptap/issues/8321). At the end of the final list item, it joins the following paragraph inside the same frame into that item. It also prevents ListKeymap from joining content across the enclosing isolating boundary.

For this document, with the caret after A:

```text
frame 1 (isolating)
  ordered list
    item: A|
  paragraph: B
frame 2 (isolating)
  paragraph: C
```

One forward Delete produces a single list item **AB** in frame 1. The separate B paragraph is removed, and frame 2 remains unchanged. The operation is one undoable transaction, with the caret between A and B. Inline marks and inline content from B are retained; the destination paragraph keeps its own paragraph attributes.

## Try the local example

Download the [source and runnable example v0.1.0](../../downloads/isolated-list-delete-v0.1.0.zip?raw=true), then extract it.

Use Node.js 24 or newer. From this directory:

```sh
npm ci --ignore-scripts
npm test
npm run demo
```

Open the local URL printed by the last command. Compare **Original** and **With extension**: click the corresponding **Place cursor after A** button, then press forward Delete once. On a Mac keyboard, forward Delete is Fn + Delete. The page shows each editor's document JSON and has reset and undo controls.

`npm run reproduce` runs the complete acceptance assertion against the pristine package and intentionally exits nonzero. It is a regression demonstration, not the passing test command.

## Add it to an existing editor

Copy `isolated-list-delete.mjs` into your application, retaining [LICENSE](LICENSE). It uses the application's existing Tiptap and ProseMirror dependencies. Import it before constructing your editor:

```js
import { IsolatedListDelete } from './isolated-list-delete.mjs';
```

Append `IsolatedListDelete` to the editor's `extensions` array alongside its existing page/frame nodes and StarterKit. Keep StarterKit's ListKeymap enabled. No installed package files are modified. [browser.mjs](browser.mjs) provides a complete working setup, including the isolating frame schema.

The included fixture pins `@tiptap/core` and `@tiptap/starter-kit` to **3.31.3**. Recheck behavior before changing these versions or adding another high-priority Delete handler.

## Verification

The 21 tests exercise actual Tiptap editors, including the complete document shape, inline marks and hard breaks, empty paragraphs, nested containers, nearest-boundary protection, native fallback, and undo/redo. A Chrome check of the included fixture also verified one forward Delete, one native undo, and one native redo. The original editor loses the second frame; the extension produces `AB` in one list-item paragraph and preserves the second frame's JSON.

## Scope

- Standard `orderedList` / `bulletList` containers and `listItem` nodes, with a collapsed caret at the end of a list item's textblock.
- A compatible following paragraph in the list's immediate parent is appended only inside the nearest isolating ancestor. Empty following paragraphs are removed without reaching into another frame.
- The nearest boundary is resolved from the caret textblock upward, so an isolating paragraph, list item, or list remains intact. An isolating following paragraph also remains intact.
- Existing list-item joins inside the frame and ordinary editing outside isolating containers continue through Tiptap's handlers. Selections that explicitly cover text also use the existing handlers.
- This extension handles the **forward Delete key**. It does not replace Backspace, modified shortcuts, direct calls to `joinItemForward`, arbitrary transactions, collaborative operations, or custom/task-list keymaps. It does not recover content already lost.
- Incompatible following blocks are not converted to text. Other extensions and custom schemas can affect native fallback behavior; use the supplied checks with your application's schema before adoption.

## Upstream status and license

The underlying report is [Tiptap #8321](https://github.com/ueberdosis/tiptap/issues/8321), and [PR #8332](https://github.com/ueberdosis/tiptap/pull/8332) is the existing upstream boundary-guard proposal. This is an independent extension for stable 3.31.3, with an explicit check for the requested one-key paragraph merge. It is not an official release or an accepted upstream fix. Check upstream status before adding a temporary compatibility extension.

The original extension, fixture and tests are [MIT licensed](LICENSE). Tiptap dependencies retain their own licenses.

If this free example saves you time, you can optionally buy me a coffee. Using it and sharing useful feedback are appreciated too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
