# Raster PDF export with a short-lived Worker

Generate image-based PDFs in a dedicated Worker, receive the finished file, and end that Worker. This free example addresses the post-export memory retention reported in [jsPDF #4017](https://github.com/parallax/jsPDF/issues/4017), using the unmodified **jsPDF 4.2.1** package.

[Download the source ZIP](../../downloads/raster-pdf-worker-v0.1.0.zip?raw=true), or copy this directory. The example includes a five-page report, cancellation, a download link, and repeatable checks.

## Use it

With Node.js 24 or newer, run these commands from the extracted directory:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run demo
```

Open the printed local URL. Select **Export 5 pages**, then **Download PDF**. The optional sample password is `sample-view`. All image generation and PDF processing happen locally.

For an application, copy `export-raster-pdf.js`, `pdf-worker.js` and `render-raster-pdf.js`, keep `jspdf` pinned to `4.2.1`, and bundle the Worker entry as well as your application. The included `server.mjs` demonstrates this with esbuild: it emits `main.js` and `pdf-worker.js` together under `/assets/`. Other bundlers need their own Worker entry handling. Serve the result over HTTP; opening the source HTML as a local file will not run it.

```js
import { exportRasterPdf } from './export-raster-pdf.js';

const controller = new AbortController();
const bytes = await exportRasterPdf(
  [
    { image: firstPageJpeg, format: 'JPEG' },
    { image: secondPagePng, format: 'PNG' },
  ],
  { unit: 'px', format: 'a4', hotfixes: ['px_scaling'] },
  { signal: controller.signal, timeoutMs: 60000 },
);
const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
downloadLink.href = url;
downloadLink.download = 'report.pdf';
// Revoke this URL when the link is replaced or its view is removed.
```

Each image is a Data URL or `Uint8Array`. Pages retain their array order and fill the selected page dimensions; prepare the desired aspect ratio before export. The second argument supplies jsPDF constructor options, including existing encryption settings. Inputs are cloned so their buffers remain usable after cancellation or failure. Functions and DOM nodes cannot be sent to a Worker.

Every call creates its own Worker. The caller receives the completed `ArrayBuffer` before terminating the Worker. Errors, cancellation and timeout also terminate it and reject the promise; the same input can then be retried. [Worker termination](https://developer.mozilla.org/en-US/docs/Web/API/Worker/terminate) ends execution immediately, so a timed-out or cancelled export has no partial PDF result.

## What was checked

The original report's 5- and 10-page JPEG cases retained about 19.5 and 38.8 MiB of JavaScript heap after forced collection in Chrome. Heap snapshots showed document references through both the static dash methods and the context2d initialization closure. Those paths are visible in [jsPDF's constructor](https://github.com/parallax/jsPDF/blob/20d32998267745aa5336e299baa65d4f45916fb5/src/jspdf.js) and [context2d module](https://github.com/parallax/jsPDF/blob/20d32998267745aa5336e299baa65d4f45916fb5/src/modules/context2d.js). Changing the dash aliases alone left the retention in place.

The included example uses its own numbered image pages. In a same-version comparison:

| Example | Direct export: extra heap after collection |
| --- | ---: |
| 5 JPEG pages, plain | 0.35 MiB |
| 5 JPEG pages, password enabled | 14.40 MiB |
| 10 JPEG pages, password enabled | 28.65 MiB |
| 1 PNG page, password enabled | 105.05 MiB |
| 2 JPEG pages from byte arrays, landscape, password enabled | 6.19 MiB |

For the Worker path, all 12 observed Workers closed, and a browser target check found no active Worker after the API scenarios. The parent page retained about 0.05 MiB of extra heap after the returned test buffers were released. The check also completed repeated and parallel exports, an invalid-PNG failure followed by retry, cancellation, timeout, a non-cloneable input failure, and two exports through the visible download page.

Independent PDF checks compared all five output pairs: page count, page size, decrypted drawing instructions and image bytes matched direct export. The original password and print-only permission settings remained effective. The downloaded five-page demo also opened correctly. Random PDF IDs and encryption can change the complete file bytes and length, so those are not used as content-equivalence checks.

These are scripted browser and PDF checks, plus inspection of rendered output, performed on September 13, 2026 with Chrome 152.0.7977.83 on macOS, Node 24.19.0, Playwright 1.62.1, esbuild 0.28.2 and pypdf 6.10.0. They do not establish immediate operating-system RSS reclamation or a reduction in peak export memory. The output buffer and any download URL intentionally keep the finished PDF available until the caller releases them.

## Run the checks

```sh
# Set this to your installed Chrome or Chromium executable.
export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
npm test

# Optional test environment, separate from the browser application.
python3 -m venv .venv
.venv/bin/python -m pip install -r test/requirements.txt
.venv/bin/python test/verify-pdfs.py
```

`npm test` starts a temporary local server, runs the browser checks, writes PDF pairs and a report under `.checks/`, and closes its browser and server. The Python command verifies those generated PDFs. On Windows, use your virtual environment's `Scripts/python.exe`. Python is only needed for the file-content checks.

The wrapper supports the demonstrated raster-page workflow. HTML capture, custom plugins, fonts, general drawing callbacks, SSR, other browsers and application-specific CSP policies have not been checked. Large inputs still require memory for the input copy and generation; keep concurrency appropriate to your application. This is a way to bound an export context's lifetime, not an upstream jsPDF fix. Recheck future releases before deciding to retain the workaround.

## License

The example is [MIT licensed](LICENSE). jsPDF and its dependencies retain their own licenses; keep the license comments when redistributing bundled output. Thanks to saurabhzaiswal for the report and reproduction.

## Optional coffee

If this saves you some time and you'd like to buy me a coffee, thank you. There's no obligation; the example stays free, and useful feedback is welcome too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
