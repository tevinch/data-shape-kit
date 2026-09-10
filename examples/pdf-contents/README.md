# PDF contents

Generate a printed, linked table of contents with page numbers verified against the PDF that will be returned. This Node.js helper works with `@react-pdf/renderer`, including documents where the contents takes several pages and moves the chapters that follow it.

Supply the heading metadata once, render matching `id` props in your document, and let the helper calculate their physical page numbers. The separate `Contents` component supplies flowing rows with indentation, wrapped titles and internal links.

## Download and run

[Download source and tests v0.1.0](../../downloads/pdf-contents-v0.1.0.zip?raw=true). Extract it and open a terminal in `pdf-contents`:

```sh
npm ci --ignore-scripts
npm test
npm run example
```

The example writes `output/contents-demo.pdf` and a JSON report with the resolved entries, page count and render-pass count. It contains a cover, a contents section that spans multiple pages, and flowing fictional report sections. A [generated sample PDF](../../downloads/pdf-contents-demo.pdf?raw=true) is also available to inspect before running the code.

The fixture pins **React 19.3.0**, **@react-pdf/renderer 4.9.0**, **pdf-lib 1.17.1** and **TypeScript 5.9.3**. The checks run on Node.js **24.19.0**. React, react-pdf and pdf-lib are runtime dependencies. Copy [`pdf-contents.ts`](pdf-contents.ts) and [`Contents.tsx`](Contents.tsx) into your TypeScript project with those dependencies. This example is distributed through GitHub; there is no package-name installation on npm.

## A complete small document

This example has a contents page followed by two sections on a shared body page. Both entries should resolve to physical page 2:

```tsx
import React from 'react';
import { writeFile } from 'node:fs/promises';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { Contents } from './Contents.js';
import { renderWithContents } from './pdf-contents.js';

const headings = [
  { id: 'setup', title: 'Setup', level: 1 },
  { id: 'checks', title: 'Checks', level: 2 },
] as const;

const result = await renderWithContents({
  headings,
  buildDocument: (entries) => (
    <Document title="Contents example" author="Tevinch">
      <Page size="A4" style={{ padding: 40 }}>
        <Contents entries={entries} title="Contents" />
      </Page>
      <Page size="A4" style={{ padding: 40, fontSize: 11 }}>
        {headings.map((heading) => (
          <View key={heading.id} wrap={false} style={{ marginBottom: 24 }}>
            <Text id={heading.id} style={{ fontSize: 18, marginBottom: 8 }}>
              {heading.title}
            </Text>
            <Text>Original sample content for this section.</Text>
          </View>
        ))}
      </Page>
    </Document>
  ),
});

await writeFile('contents-example.pdf', result.buffer);
console.log(result.entries.map(({ id, pageNumber }) => [id, pageNumber]));
// [ ['setup', 2], ['checks', 2] ]
```

For a larger, styled document with a cover, multiple contents pages and automatic body pagination, see [`sample-document.tsx`](sample-document.tsx) and [`example.tsx`](example.tsx). The helper does not assume a fixed number of pages per chapter or a one-page contents section.

## Why verify the final render?

A first render can establish the chapter positions, but inserting or expanding a contents section may move them. The helper performs these steps:

1. Give the document factory all heading entries with `pageNumber: null` and render a full PDF.
2. Read each heading's named destination from that PDF and resolve its physical page.
3. Render the factory again with those numbers.
4. Return only when the numbers supplied to that render match its actual destinations. Otherwise repeat within the configured limit.

The returned buffer is the original verified render. The helper does not merge pages, resave the PDF or rewrite its links. Every call keeps its own entries and convergence state. No React context, state update from a render callback, global chapter map or private react-pdf layout hook is required.

A stable document commonly needs two full renders. A contents section that grows after the first pass can need more. Each pass renders and parses the whole document, so use this deliberately for generated reports, with data and assets loaded before the call.

## API

`renderWithContents({ headings, buildDocument, maxPasses? })` returns a promise:

| Option | Meaning |
| --- | --- |
| `headings` | Ordered `{ id, title, level? }` entries; order determines the contents order |
| `buildDocument(entries)` | Synchronous factory returning the React element for the document; render the supplied entries and corresponding destination IDs |
| `maxPasses` | Integer from 1 to 20; defaults to 6 |

| Result field | Meaning |
| --- | --- |
| `buffer` | The verified PDF bytes, ready to write or send |
| `entries` | Heading metadata with resolved one-based `pageNumber` values |
| `pageCount` | Total physical pages in that PDF |
| `passes` | Number of completed full renders |

Levels default to 1 and accept integers 1 through 6. Equal display titles are supported when their IDs differ. IDs must be unique and use the portable form `[A-Za-z0-9][A-Za-z0-9._:-]*`, such as `chapter-2.notes`. Use these exact IDs on the corresponding react-pdf elements. Do not prefix the element's `id` with `#`; the component adds that prefix to its internal links.

`Contents({ entries, title? })` is a flowing component for a caller-owned `Page`. The title defaults to `Contents`. It keeps each title/page-number row together, reserves a page-number column and indents by level. A title can wrap onto several lines within its row. Set the enclosing Page size, padding and other page chrome in your own document.

Options and heading records are plain objects. Invalid types/shapes throw `TypeError`; invalid ranges, empty titles, duplicate or invalid IDs throw `RangeError` before rendering. Sparse heading arrays and unknown own keys are rejected. Heading data is copied before generation; entries passed to the factory and returned in the result are frozen. The PDF buffer remains writable by its recipient.

An empty heading list is valid: the document renders once and returns no entries. A registered heading missing from the PDF, or pointing to an invalid destination, causes an error naming that ID.

## Convergence and limits

The exported `ContentsConvergenceError` has `reason: 'cycle' | 'limit'` and a `passes` count. A repeating page-number pattern or an exhausted pass limit causes this error instead of returning a PDF with unverified page numbers. Stability on the last permitted pass still succeeds. Factory, renderer and parser failures propagate.

Keep the document deterministic throughout a call. Do not fetch changing data, use random layout choices, or mutate content between passes. Render each registered destination once. Use the supplied page numbers in the printed contents; the helper cannot check arbitrary text that your custom factory chooses to print.

Numbers refer to **physical PDF pages**, including covers and every contents page. Custom printed offsets, Roman numeral front matter and PDF PageLabels are not handled. The helper does not discover headings by scanning arbitrary JSX; the heading registry and matching IDs are the integration contract.

This is a **Node generation solution**. Browser viewers and browser bundles are outside the tested scope. The contents row uses the fonts configured for your document; register a suitable font when your titles need glyphs beyond the built-in fonts. The title and first row stay together, and every later row stays together individually. Each such group must fit within a page; oversized groups remain a react-pdf layout constraint. Render passes are bounded, but this helper does not impose a document-size or execution-time limit on the renderer.

## Verification and background

The tests render and parse actual PDFs. They cover multi-page contents, automatic body flow, double-digit page numbers, duplicate display titles, nested and wrapped rows, missing destinations, invalid inputs, immutable entries, concurrent calls, cycle detection and a growing contents case that needs at least three passes. A TypeScript consumer checks the emitted declarations. The sample PDF's text, destinations and internal links are also checked independently, and its pages are rendered for visual inspection before publication.

The solution responds to the printed contents and page-number discussions in [react-pdf #479](https://github.com/diegomura/react-pdf/issues/479). It builds on the documented [destination and internal-link API](https://react-pdf.org/docs/v4/advanced/document-navigation) and reads the generated PDF using [pdf-lib](https://pdf-lib.js.org/docs/api/classes/pdfdocument). It is an independent integration example. The renderer's native bookmarks remain useful for a viewer's navigation sidebar; this component supplies the printed contents pages.

## License

[MIT](LICENSE). Use, modify and share the code while retaining the license notice.

## Buy me a coffee, if this helped

This code is free to use, modify and share. If it saved you some time and you feel like buying me a coffee, a small contribution is welcome. There is no obligation; feedback and useful examples are appreciated too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
