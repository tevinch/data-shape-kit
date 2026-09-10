# Highlight phrases across PDF text fragments

A free MIT module and copyable React-PDF component for highlighting literal phrases that span text items or explicit line endings. The runnable example uses an invented two-page PDF, with repeated phrases and changes in font style.

[Download source, tests and sample PDF](../../downloads/pdf-fragment-highlight-v0.1.0.zip?raw=true)

## The integration problem

A PDF text layer can split a sentence across lines and split a word across several text items. Searching each item separately misses those phrases. This appears in [React-PDF #614](https://github.com/wojtekmaj/react-pdf/issues/614), [#1803](https://github.com/wojtekmaj/react-pdf/issues/1803) and [#516](https://github.com/wojtekmaj/react-pdf/issues/516).

This module searches a page-wide stream and maps every occurrence back to the original item offsets. React-PDF's existing text layer positions the highlights. It does not estimate character widths or add a separate coordinate overlay.

## Run the example

Extract the ZIP and open a terminal in `pdf-fragment-highlight`. Use Node.js 22.22.2 or newer within Node 22, 24.15.0 or newer within Node 24, or 26.0.0 or newer. The executed runtime is Node.js 24.19.0.

```sh
npm ci --ignore-scripts
npm test
npm run typecheck
npm run build
npm start
```

Open the loopback URL printed by the preview server. React and React DOM are pinned to 19.3.0, React-PDF to 10.5.0, and PDF.js to 5.4.296, the version required by this React-PDF release. The application bundles its matching worker; mixing worker and library versions can break loading.

Try these cases:

1. The default phrase crosses three lines and several font fragments. Page 1 contains two occurrences; page 2 contains one.
2. Add `Invoice A+B (draft) & <review>` as the second phrase. Punctuation is literal, and both queries remain active.
3. Change a phrase to something absent, clear it, or toggle case sensitivity. Old highlights should disappear when they no longer match.
4. Paste line breaks inside the primary phrase. Whitespace runs and explicit PDF line endings are normalized for searching.
5. Resize the window or change pages. The library text layer keeps the marks aligned with the displayed text.

The sample and worker are local application assets. The demo does not upload files, store data, or modify the PDF. Python is unnecessary to run it; `build-sample.py` is an optional fixture generator that requires `reportlab`.

## Copy the mapping module

Copy [highlight-text.mjs](highlight-text.mjs), [highlight-text.d.mts](highlight-text.d.mts) and [LICENSE](LICENSE). The module has no runtime dependencies.

```js
import { highlightTextItems } from './highlight-text.mjs';

const items = [
  { str: 'A sha' },
  { type: 'beginMarkedContent' },
  { str: 'red ', hasEOL: true },
  { str: 'sentence' },
];

const result = highlightTextItems(items, ['A shared sentence']);
console.log(result.matches.length); // 1
console.log(result.matches[0].segments.map(part => part.itemIndex)); // [0, 2, 3]
console.log(result.html[3]); // <mark>sentence</mark>
```

`highlightTextItems(items, queries, { caseSensitive: false })` returns:

| Field | Meaning |
| --- | --- |
| `text` | The whitespace-normalized page stream, retaining original case. |
| `matches` | Every occurrence, ordered by query index and then occurrence. Overlapping matches are included. |
| `matches[].queryIndex` | Which input query matched. |
| `matches[].start` / `end` | UTF-16 offsets in `text`, with an exclusive end. |
| `matches[].segments` | Original `itemIndex`, `start` and exclusive `end` offsets for each affected source item. |
| `html` | One escaped HTML string per original item; only fixed `mark` elements are added. Non-text entries are empty strings. |

The input arrays and item strings are unchanged. Empty items and marked-content entries retain their array positions. Overlapping or adjacent highlight segments merge for rendering, so the number of mark elements is not the number of search occurrences. Invalid argument structures throw `TypeError`; blank queries produce no matches.

## Connect to React-PDF

Copy [HighlightedPage.tsx](HighlightedPage.tsx) alongside the mapping module and its declarations. Use it inside a React-PDF `Document`. The complete [App.tsx](App.tsx) shows worker setup, loading states, page navigation, responsive width measurement and match counts; [main.tsx](main.tsx) imports both library layer styles and the example CSS.

```tsx
import { Document, pdfjs } from 'react-pdf';
import { HighlightedPage } from './HighlightedPage';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const queries = ['A shared sentence'];

export function Example() {
  return (
    <Document file="/sample.pdf">
      <HighlightedPage key={1} pageNumber={1} queries={queries} width={560} />
    </Document>
  );
}
```

The component uses public `onGetTextSuccess` and `customTextRenderer` callbacks. Pass the exact original `textContent.items` array to the mapper and use the renderer's original `itemIndex`; filtering entries first can misalign the mapping. Keep a separate keyed component for each page. The optional `onMatchCount` callback reports occurrences for that page.

Include this CSS when copying the component. The text layer is transparent above the PDF canvas, so the background must remain translucent to keep the original letters readable:

```css
.react-pdf__Page__textContent mark {
  color: inherit;
  font: inherit;
  line-height: inherit;
  background: rgba(255, 211, 46, 0.42);
}
```

Retain the inherited text properties when changing the highlight background. The mapper escapes source text before adding its fixed tags; do not replace that step with interpolation of PDF text or query text into HTML.

## Matching boundaries

Items are concatenated in PDF.js extraction order. An item boundary alone adds no space, because a single word can span font fragments. `hasEOL` adds a whitespace boundary, and whitespace runs collapse to one space. If a PDF omits a necessary space and line-ending signal, the module cannot infer the author's intended words.

Case-insensitive mode uses JavaScript lowercasing with offset mapping, including length-changing lowercase conversions. It does not provide locale collation, accent folding, ligature expansion, or full Unicode case folding. Queries are literal; regex punctuation has no special meaning.

This is page-local search over available text. It does not perform OCR, reconstruct multi-column reading order, remove line-end hyphens, search across page boundaries, or persist annotations. A scanned PDF without extracted text has nothing to match. For a different extraction order or normalization policy, define that policy before adopting the mapper.

## Verification

The 11 tests cover the pure mapper and actual PDF.js extraction of the two-page fixture, including repeated matches across more than three original text items. Type checking and the production build pass. Chrome checks cover literal punctuation, overlapping queries, case sensitivity, query line breaks, clearing, page changes and aligned highlights at desktop and 390-pixel widths.

The source ZIP is checked through a fresh locked install, tests, type checking and build; the generated files are compared byte-for-byte with the browser-reviewed build. A separate consumer copies the module and component, runs the documented module example and checks TypeScript imports. This does not establish behavior for arbitrary PDFs or other browsers. Vite reports a bundle-size advisory for the PDF viewer; the example is intended as an integration reference.

## License

Original code and sample data are [MIT licensed](LICENSE). Preserve the license when copying them and the included third-party notices when redistributing a built example.

## Buy me a coffee, if this helped

This example is free. If it saves you some time and you feel like buying me a coffee, a small contribution is welcome. There is no obligation; useful feedback is appreciated too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please use the asset and network shown above.
