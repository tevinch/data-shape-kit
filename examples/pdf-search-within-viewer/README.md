# Keep embedded PDF search inside its viewer

Searching an embedded PDF can move the surrounding article or application panel. This example keeps navigation inside the PDF viewer while showing the selected text, including rotated pages, repeated Next/Previous operations and wraparound.

It addresses [PDF.js #21997](https://github.com/mozilla/pdf.js/issues/21997) with a version-specific change for **PDF.js 6.3.289**. It uses the standard `PDFViewer`, `PDFLinkService` and `PDFFindController` integration. It is a standalone example and source patch; it is not an upstream release.

## Try it

Download and extract the [example ZIP](./pdf-search-within-viewer.zip), open a terminal in its directory, then run:

```sh
python3 prepare.py
python3 -m http.server 8000 --bind 127.0.0.1
```

Open [the local example](http://127.0.0.1:8000/) in a current browser. Python 3.10 or newer is required. Preparation downloads the official npm package, verifies its SHA-512 integrity and the viewer module's SHA-256, and creates `runtime/web/pdf_viewer.scoped.mjs` beside the unchanged original. It installs no dependencies and runs no package scripts.

Use **Run off-screen search** to find text on page three. **Next match** and **Previous match** continue through the document. **Rotate 90 degrees** changes the actual PDF page rotation. The other two check buttons exercise repeated navigation and host settings; their results appear below the viewer.

The **Original viewer** link uses the unmodified module for comparison. The **Iframe example** embeds the same reading panel inside a second scrollable page. Keep the PDF's viewport visible in its host: if an outer container clips it, preserving that outer position cannot also reveal the clipped area.

## Apply the change

For an embedding based on the official prebuilt viewer, use the prepared scoped module in the same place as `pdf_viewer.mjs`:

```js
const { EventBus, PDFViewer, PDFLinkService, PDFFindController } =
  await import("./runtime/web/pdf_viewer.scoped.mjs");
```

Keep the matching 6.3.289 core, worker, CSS, fonts and other runtime assets. [index.html](./index.html) contains the complete initialization and search-event wiring. Retain your existing document settings and application controls. This patch expects `PDFLinkService.setViewer(viewer)` to have been called; custom link-service adapters need their own integration.

For a source build checked out at the official `v6.3.289` tag:

```sh
git apply --check /path/to/pdfjs-6.3.289.patch
git apply /path/to/pdfjs-6.3.289.patch
```

Then follow the [PDF.js build instructions](https://github.com/mozilla/pdf.js/tree/v6.3.289#building-pdfjs). The source patch applies cleanly to that tag. The complete upstream build and reference-test suite have not been run for this example; the browser checks below use the equivalent changes in the prebuilt module. Review newer releases before retaining this patch.

## Why two scrolling paths change

1. Find navigation first selects a page. PDFViewer's existing offset-based helper can climb past a viewer with no overflow and scroll an outer ancestor. The patch gives that helper an explicit viewer boundary. It retains the original offset and destination arithmetic. This also confines ordinary PDFViewer page navigation, not only search.
2. The selected text is then revealed. Native `Element.scrollIntoView()` can scroll every ancestor. The replacement measures the actual highlighted span and scrolls only the explicit PDF container, preserving top alignment, horizontal centering, scroll margins, percentage/calculated scroll padding and the host's `scroll-behavior` setting.

The existing find-controller selection guards remain in place. The implementation neither cancels the search nor restores outer positions after a jump, and does not depend on the browser-specific `container: "nearest"` option. Actual span bounds preserve the rotated-text behavior introduced by [PDF.js #20951](https://github.com/mozilla/pdf.js/pull/20951).

## Checks and limits

Checked on 22 September 2026 in Chrome on macOS with the included three-page PDF and the real PDFViewer/search controller. The original module completed the search but changed outer offsets in both a plain embed and an iframe. A match-only change still moved the outer panel when a page fit without scrollbars; bounding the earlier page-navigation path corrected that case too.

| Host | Rotation and repeated navigation | Host settings | Result |
| --- | --- | --- | --- |
| Plain embed, packaged example | 72 searches | 24 searches | Selected spans visible; outer/document offsets unchanged |
| Same-origin iframe inside another scrolling page | 72 searches | 24 searches | Selected spans visible through iframe/host bounds; all recorded outer offsets unchanged |

The rotation checks cover 0/90/180/270 degrees, page-width and 1.8 zoom, all six matches, wraparound and Previous. Each checks the rendered text-layer rotation, selected span's page, actual search/highlight calls and visible bounds. Host-setting checks cover small pages with no overflow, percentage and calculated padding, and observed intermediate positions during smooth scrolling. [verification.json](./verification.json) records the scope and module checksum.

These counts describe search operations within the included scenarios, not a test of every PDF.js feature.

The geometry assumes the standard PDFViewer structure, an axis-aligned container and no additional clipping scroller between that container and the text layer. PDF page rotation is supported; rotating or skewing the entire host with CSS is outside this example's scope. CSS overlays that cover text are also the embedding application's responsibility. Hidden zero-size viewers cannot reveal a search match until they are shown.

Firefox and Safari have not been exercised here. The implementation uses standard DOM geometry and container scrolling, but compatibility with those engines remains to be checked. These checks use the browser scenarios included here; they are not confirmation from the original reporter.

The patch, helper and example in this directory are available under [Apache-2.0](./LICENSE). PDF.js is copyright Mozilla Foundation; the changed source retains its notices. Supporting example and changes: copyright 2026 Tevinch.

## Optional coffee

If this helps your project and you'd like to buy me a coffee, thank you. It's entirely optional; the example and patch are free.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
