# Keep PDF pages when resources contain duplicate names

**Upstream review — 22 September 2026:** The source change is now submitted as [libcupsfilters PR #254](https://github.com/OpenPrinting/libcupsfilters/pull/254). It is open for review, not merged or released. The original reporter has offered an Arch/Canon MF230 printing-chain test; a successful result from that environment has not yet been reported.

This source patch lets libcupsfilters continue when PDFio reports a recoverable warning. It fixes the tested case where repeated references to the same image caused a PDF conversion to return zero pages, or to keep the pages but lose their images.

The problem is tracked in [libcupsfilters #230](https://github.com/OpenPrinting/libcupsfilters/issues/230). PDFio's error callback must return `true` to continue a warning; the affected callback always returned `false`. The patch also forwards warnings and errors through the filter's supplied logger and preserves the requested error-sheet behavior.

Download the [patch and regression checks](../../downloads/pdf-warning-recovery-v0.1.0.zip?raw=true), or read the [unified diff](libcupsfilters-pdfio-warnings.patch). This is a proposed source fix for maintainers and package builders. It is not an upstream release or an installable replacement package.

## Apply and check

Use a clean libcupsfilters **2.2.1** source tree. The patch also applies to the current filter sources at [`c5dc208`](https://github.com/OpenPrinting/libcupsfilters/commit/c5dc208c05068ed2b1428e3562516a4bd08e0f0f). Check newer upstream versions before applying it.

```sh
cd /path/to/libcupsfilters-2.2.1
patch --dry-run -p1 < /path/to/pdf-warning-recovery/libcupsfilters-pdfio-warnings.patch
patch -p1 < /path/to/pdf-warning-recovery/libcupsfilters-pdfio-warnings.patch
```

Configure the source tree using its [build instructions](https://github.com/OpenPrinting/libcupsfilters/blob/master/INSTALL.md) and your normal dependency paths. The test driver needs the generated `config.h`, a C compiler, CUPS headers/library, PDFio **1.6.5**, and zlib. The rendering checks need Python 3.10+ and Poppler's `pdftoppm` on `PATH`.

From this example's directory:

```sh
sh build-driver.sh /path/to/libcupsfilters-2.2.1 ./filter-check
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python verify.py --driver ./filter-check
```

The driver compiles the real `pdftopdf.c` and `ipp-options.c`, then calls `cfFilterPDFToPDF()` directly. It reads and writes synthetic PDFs only. The test uses a temporary directory and removes it afterward. To use a different Poppler location, add `--pdftoppm /path/to/pdftoppm`.

`build-driver.sh` uses `pkg-config` for PDFio and `cups-config` (or `pkg-config`) for CUPS. You can provide `PDFIO_CFLAGS`, `PDFIO_LIBS`, `CUPS_CFLAGS`, `CUPS_LIBS`, `CC`, `CFLAGS`, `LDFLAGS`, and `CONFIG_DIR` for an existing local dependency build. It does not install libraries or change a printing service. For a normal package build, use the project's usual build and test commands after applying the patch.

## What was checked

The unpatched 2.2.1 conversion returned success with **zero pages** for the two-page cairo fixture shared in the issue. Its fit and two-up paths kept page counts but lost the red images. The patched conversion retained the images: direct copy and selected-page output matched the input pixels, while fit and two-up matched a clean-resource control.

The included independently generated fixture draws the same red image three times on page 1 and twice on page 2. Its checks cover:

- Direct copy, selection of page 2, A4 fit and two-up output, including page counts and rendered pixels.
- Delivery of warning messages to a custom logger with its callback context.
- `job-error-sheet-when=on-error` retaining two pages for a warning, and `always` adding the requested report page with the warning correctly classified.
- A non-PDF header returning failure and reaching the error logger.
- Duplicate names pointing to different objects, with the compatibility limit below checked explicitly.

The regression command fails on unpatched 2.2.1. The patched 2.2.1 and current `pdftopdf.c`/`ipp-options.c` sources were checked with PDFio 1.6.5, CUPS 2.3.4 and a targeted native build on macOS arm64. This does not establish a full `make check` result, a Linux distribution build, or physical printer behavior. Other malformed-PDF paths are outside this patch's coverage.

## Conflicting values still need care

PDF dictionaries must not contain duplicate names. In PDFio **1.6.5**, recovery keeps the **first** value; QPDF keeps the **last**. When the duplicate names refer to the same image, the tested content is preserved. When they refer to different images, this patch does **not** provide QPDF-equivalent output: the issue's blue/red example keeps the first, blue object.

The patch leaves that PDFio policy intact and makes its warning visible through the configured logger. It does not correct the PDF producer. Thanks to jbtheou and jasonvanwyk for the reports and synthetic reproductions.

## License

The libcupsfilters patch retains the upstream [Apache 2.0 license with CUPS exceptions](LICENSE) and [notices](NOTICE). The patch changes warning recovery, logging and error-sheet classification in `pdftopdf.c` and its private header. The accompanying driver, build script and regression generator are Copyright 2026 Tevinch and licensed under Apache 2.0.

## Optional coffee

If this saves you some time and you'd like to buy me a coffee, thank you. It's entirely optional; the patch and checks are free.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
