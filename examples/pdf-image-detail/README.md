# Keep detail when exporting PDF images with Docling

If increasing `images_scale` makes an exported PNG larger but leaves its contents blurry, configure the initial PDF rendering scale as well. This guide addresses the standard threaded PDF pipeline in Docling 2.129.0, with docling-parse 7.21.0, and the regression reported in [Docling #4350](https://github.com/docling-project/docling/issues/4350).

## Configuration

Keep your existing `PdfPipelineOptions`, including OCR, table extraction and image generation. Add `ThreadedDoclingParseBackendOptions` to the `PdfFormatOption` before constructing the converter:

```python
from docling.datamodel.backend_options import ThreadedDoclingParseBackendOptions
from docling.datamodel.base_models import InputFormat
from docling.document_converter import DocumentConverter, PdfFormatOption

render_scale = max(
    pipeline_options.images_scale,
    3.0,  # Default standard-pipeline OCR uses 3; tables use 2.
)

converter = DocumentConverter(
    format_options={
        InputFormat.PDF: PdfFormatOption(
            pipeline_options=pipeline_options,
            backend_options=ThreadedDoclingParseBackendOptions(
                render_scale=render_scale,
            ),
        ),
    },
)
```

Use the converter with your existing page, picture, table and Markdown export code. The complete [official export-figures example](https://docling-project.github.io/docling/_generated/examples/export_figures/) demonstrates those exports. Set `generate_page_images=True` and `generate_picture_images=True` to retain the images you want to save.

This example covers the default standard-pipeline stage scales. If you already supply `ThreadedDoclingParseBackendOptions`, copy that object with `model_copy(update={"render_scale": max(existing_options.render_scale, render_scale)})` and pass the copy, preserving your password, parser threads, font options and any already-higher rendering scale. Do not replace custom backend settings with defaults.

For the default OCR scale of 3, an image export scale of 2 uses an initial rendering scale of 3; an image export scale of 5 uses 5. For custom OCR or enrichment settings, include the effective engine scale in this maximum; the automatic OCR selector in this version does not forward its `scale` field to the selected engine. Choose the required resolution carefully: higher initial scales increase processing and memory use.

## Why both settings matter

`images_scale` requests the output resolution. The threaded backend's [`render_scale`](https://github.com/docling-project/docling/blob/v2.129.0/docling/datamodel/backend_options.py#L293) also influences resolution during the initial decode. It defaults to 1.

The [threaded renderer](https://github.com/docling-project/docling-parse/blob/v7.21.0/src/pybind/docling_threaded_renderer.h#L63) passes that initial scale to the bitmap decoder. The decoder can [reduce eligible JPEG/JPX images](https://github.com/docling-project/docling-parse/blob/v7.21.0/src/parse/pdf_states/bitmap.h#L577) before rendering. A later larger render cannot reconstruct the discarded image detail.

This uses an existing released option and preserves detail already present in the original PDF. Recheck newer releases before keeping the workaround in long-lived applications.

## Verification

Checked on 22 September 2026 with the issue's [nine-page PDF](https://arxiv.org/abs/2206.01062), using Docling **2.129.0**, docling-parse **7.21.0**, docling-core **2.98.0**, Python **3.12.14**, macOS arm64 and CPU/RapidOCR ONNX. OCR and table extraction remained enabled, with the default OCR language/mode and scale of 3.

| Export scale | Initial scale, default / adjusted | Page PNG dimensions | Completed output in each run |
|---|---|---|---|
| 2 | 1 / 3 | 1224 × 1584 | 9 pages, 6 pictures, 5 tables |
| 5 | 1 / 5 | 3060 × 3960 | 9 pages, 6 pictures, 5 tables |

Figure 3's small text and labels were clearer with the adjusted initial scale, in both its picture PNG and the page-4 PNG. All four runs produced identical final extracted text and table contents/cell spans. Each run processed 10 nonempty OCR regions through actual inference; table processing covered all nine pages. This establishes that those stages ran, not that every recognition result is correct.

All six Markdown image references resolved and matched the separately exported picture PNGs pixel-for-pixel. The source PDF, model files and test outputs are not bundled here; the input and complete export workflow are linked above.

These are scripted conversion checks and visual inspection of the resulting images, not confirmation from the original reporter. Other PDFs, OCR engines, platforms and custom enrichment configurations were not tested. The historical 2.115.0 version was inspected in source but was not rerun.

## Optional coffee

If this saves you some time and you'd like to buy me a coffee, thank you. It's entirely optional; the guide is free.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
