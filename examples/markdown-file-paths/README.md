# Markdown file paths

Keep links and images with spaces in their paths when saving and reopening Markdown in **Tiptap 3.31.4**. For example, `[My plan](<docs/My Plan.md>)` stays a link after `getMarkdown()` and a fresh editor load.

[Download the source and example](../../downloads/markdown-file-paths-v0.1.0.zip?raw=true) · [Inspect the extension module](markdown-file-paths.mjs) · [Original report](https://github.com/ueberdosis/tiptap/issues/8374)

The two extensions use Tiptap's public `extend()` API. They wrap space-containing destinations in angle brackets, escape literal backslashes and angle brackets inside them, and pass the result to the existing Markdown serializer. They keep the `link` and `image` names, parsing, commands and configuration. Installed package files are unchanged.

## Use in your editor

Copy `markdown-file-paths.mjs` into your application. This example pins the Tiptap packages to 3.31.4; check your resolved versions before using it with another release.

```js
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { FilePathLink, FilePathImage } from './markdown-file-paths.mjs';

const editor = new Editor({
  element: document.querySelector('#editor'),
  extensions: [
    StarterKit.configure({ link: false }),
    FilePathLink.configure({ openOnClick: false }),
    FilePathImage,
    Markdown,
  ],
  content: '[My plan](<docs/My Plan.md>)\n\n![](<images/My Photo.png>)',
  contentType: 'markdown',
});

const saved = editor.getMarkdown();
// Persist `saved` using your application's existing save operation.
```

Replace your existing Link and Image entries with these extensions; do not register both copies. Disable StarterKit's built-in Link as shown. Carry over your current Link and Image options, including `isAllowedUri`, `HTMLAttributes` and `inline`. The example's `openOnClick: false` is optional and only makes editing the demo easier.

## Run the example

Use Node.js 24 or newer. From the extracted `markdown-file-paths` directory:

```sh
npm ci --ignore-scripts
npm test
npm run dev
```

Open [the local example](http://127.0.0.1:49180). Edit the document, click **Save Markdown**, then **Reopen saved Markdown**. Repeat to inspect the Markdown, file paths and document JSON. The save button retains the Markdown in page memory; closing or reloading the page resets it. It does not write a file or send the document to a server. The local server serves only the example and its sample assets.

The [stock comparison](http://127.0.0.1:49180/?stock=1) uses the unmodified extensions: the same link and image become plain text after the first save/reopen. `npm run reproduce` runs the regression suite with the stock extensions and intentionally exits nonzero (four failures, two passing controls).

## Verification and limits

Six Node/jsdom integration checks cover editing followed by three save/destroy/recreate cycles, block and inline images, ordinary titles, Unicode, parentheses, escaped angle brackets, backslashes, entity-looking file names, ordinary paths and encoded spaces. They also check that configured link validation runs and rejects a disallowed path without changing content, and that configured HTML attributes remain effective.

Software-operated Chrome checks confirmed three save/reopen cycles preserved the edited example's full document JSON, exact destinations and loaded image. The stock comparison lost both link and image structures on its first reopen. These are scripted and software-operated checks, not human manual validation or confirmation from the original reporter.

This addresses destination serialization, not general lossless Markdown conversion. Existing serializer behavior remains: for example, whitespace at the edge of linked text can move outside the link mark. Custom marks, unsupported document attributes, multiline destinations and unrelated title/alt-text escaping need their own checks. Keep an editor JSON backup when exact editor-state preservation matters. The example was not integrated into OpenCloud and does not repair documents already saved with missing link/image structure.

As of 3 October 2026, the original issue remained open, with another contributor offering to work on it. This is an independently maintained application example, not an upstream fix. Prefer an official release that resolves the problem when available, and retest your documents before removing the extensions.

Free under the [MIT license](LICENSE). See Tiptap's [extension API](https://tiptap.dev/docs/editor/extensions/custom-extensions/extend-existing) for configuration and inheritance.

## Optional coffee

If this saved you some time, a coffee is welcome. Please use the example freely either way.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
