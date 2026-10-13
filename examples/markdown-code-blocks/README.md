# Preserve indented Markdown code blocks

Tiptap **3.31.4** drops fenced code blocks whose opening fence starts with one to three spaces. Saving the document then loses the code. This example keeps those blocks through import, editing, saving and reopening, using a small [`CodeBlock.extend()` configuration](code-block.mjs).

For example, `before\n\n ```\n code\n ```\n\nafter` keeps both paragraphs and a code block containing `code`. The stock extension leaves only the paragraphs.

## Release check on 13 October 2026

The newly released [Tiptap 3.32.0](https://github.com/ueberdosis/tiptap/releases/tag/v3.32.0) still drops the indented block. With all Tiptap packages set to 3.32.0 and Marked kept at 17.0.6, the same Node/jsdom suite passed 3 of 31 cases with the stock extension and all 31 with this example's extension. Those checks include editing and three consecutive save/reload/reopen cycles. The runnable example below remains pinned to 3.31.4; the 3.32.0 checks were scripted Node checks, without a new browser or reporter validation.

The targeted upstream [PR #8480](https://github.com/ueberdosis/tiptap/pull/8480) is open and unmerged as of this check. It accepts indented fences and adjusts tilde-fence content. Its discussion links a [deploy preview](https://deploy-preview-8480--tiptap-embed.netlify.app), which I have not validated. Follow that repair and prefer an official release when your complete workflow passes without this extension.

## Use in an editor

Copy [code-block.mjs](code-block.mjs) into your application. This example pins Tiptap packages to **3.31.4** and Marked to **17.0.6**. Replace the standard code-block extension once:

```js
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { MarkdownCodeBlock } from './code-block.mjs';

const editor = new Editor({
  element: document.querySelector('#editor'),
  extensions: [
    StarterKit.configure({ codeBlock: false }),
    MarkdownCodeBlock.configure({
      HTMLAttributes: { class: 'code-sample' },
      enableTabIndentation: true,
      tabSize: 2,
      exitOnTripleEnter: false,
    }),
    Markdown,
  ],
  content: 'before\n\n ```\n code\n ```\n\nafter',
  contentType: 'markdown',
});

const saved = editor.getMarkdown();
editor.commands.setContent(saved, { contentType: 'markdown' });
```

The extension keeps the `codeBlock` node name, schema, HTML rendering and editing commands. Do not register it alongside another `codeBlock` extension. CodeBlockLowlight, custom code schemas and custom Marked tokenizers need their own integration checks.

## Run the example

From this directory, with Node.js 24+ and pnpm 11:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm test
pnpm dev
```

Open [the local example](http://127.0.0.1:49186). Import Markdown, edit the code, save it, and reopen the saved Markdown in a new editor. The sample stores text only in the current page; it has no persistence server. Closing the page loses that sample state.

`pnpm reproduce` runs the same assertions with the unmodified extension and intentionally exits nonzero. The `?stock` URL option also runs the browser example with the unmodified extension.

To repeat the browser checks with Google Chrome installed, leave `pnpm dev` running and use a second terminal:

```sh
pnpm test:browser
```

The script uses Playwright to operate Chrome. It fails on content changes, missing settings or browser errors and prints its results to the terminal.

## What changes

The import handler normalizes only the fenced block already identified by the lexer. It uses the original token's code-line count to read the body from its raw text, removes up to the opening fence's indentation from those lines, and delegates to the parent parser. It preserves the lexer's existing block boundary; a four-space-indented fence inside the code stays code. It does not trim the code text. This also handles Marked 17.0.6's different indentation handling for backtick and tilde fences and for lines shorter than the opening indentation.

The export handler chooses a fence longer than the matching runs inside the code. A language containing a backtick uses a tilde fence. A separating space and escaped backslashes keep language metadata stable across saves. This avoids repairing the import only to lose embedded fences on the next save. Fence style and indentation in the Markdown source can change; code text and document structure are the preservation targets.

## Verification and limits

The Node/jsdom suite checks 31 cases: zero to three spaces before either fence; empty blocks; internal indentation; shorter-indented lines; blank lines, trailing spaces and whitespace-only content; Unicode; code containing fences; leading tildes, backticks and literal backslashes in language metadata; ordinary four-space code; multiple blocks; unclosed fences, including fence-looking content at EOF; empty openers at EOF; and a blockquote. It checks the document schema, surrounding bold text, HTML settings, direct edits and three consecutive save/reload/reopen cycles.

Software-operated Google Chrome 155 checks the original failure, configured language classes, real keyboard Tab and Enter input, three save/reopen cycles, read-only behavior and the import/save/reopen cases, including fences inside code and special language metadata. These are scripted checks, not human testing or confirmation from the issue reporter.

This is an independent example for the pinned versions, not an upstream release. It does **not** fix the separate ordered-list indentation problem in [#8404](https://github.com/ueberdosis/tiptap/issues/8404), which has [PR #8405](https://github.com/ueberdosis/tiptap/pull/8405). It does not promise lossless conversion for arbitrary Markdown extensions or fix unrelated links, lists or tables. Check your actual documents before adopting it, and prefer an official release once your complete workflow passes without this extension.

The import report and suggested direction came from [Eronne in #8460](https://github.com/ueberdosis/tiptap/issues/8460). The separate fence-serialization problem is described in [#8341](https://github.com/ueberdosis/tiptap/issues/8341), with upstream work in [#8399](https://github.com/ueberdosis/tiptap/pull/8399) and [#8424](https://github.com/ueberdosis/tiptap/pull/8424). Those PRs have preview builds; this example does not replace their review. It uses Tiptap's documented [extension API](https://tiptap.dev/docs/editor/extensions/custom-extensions/extend-existing) and [Markdown integration hooks](https://tiptap.dev/docs/editor/markdown/guides/integrate-markdown-in-your-extension).

## Optional coffee

This example is free under the MIT license. If it saves you some time, you're welcome to buy me a coffee. No contribution is expected.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
