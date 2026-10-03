# Restore double quotes in Docling PDF text

If a PDF displays double quotes correctly but Docling exports `ÒSample AgreementÓ`, switching the standard PDF pipeline to its existing PDFium backend can restore the text. This configuration worked for the updated embedded-TrueType/MacRoman sample in [Docling #4493](https://github.com/docling-project/docling/issues/4493).

## Use the released alternate backend

Keep your existing `PdfPipelineOptions` object, including its OCR, table and image settings. Set `backend` on `PdfFormatOption` before constructing the converter:

```python
from pathlib import Path

from docling.backend.pypdfium2_backend import PyPdfiumDocumentBackend
from docling.datamodel.base_models import InputFormat
from docling.document_converter import DocumentConverter, PdfFormatOption

# pipeline_options is the PdfPipelineOptions object from your current conversion.
converter = DocumentConverter(
    format_options={
        InputFormat.PDF: PdfFormatOption(
            pipeline_options=pipeline_options,
            backend=PyPdfiumDocumentBackend,
        ),
    },
)
result = converter.convert(Path("input.pdf"))
result.document.save_as_markdown(Path("output.md"))
result.document.save_as_json(Path("output.json"))
```

For an otherwise default conversion, omit `pipeline_options=pipeline_options`. The regular `docling` installation includes PDFium; a minimal installation needs the `docling-slim[format-pdf-pypdfium2]` extra in addition to the dependencies for its existing pipeline.

Parser-specific `ThreadedDoclingParseBackendOptions` do not transfer to this backend. If your input needs a password, retain it through the documented `PdfBackendOptions(password=...)` option. Keep the original PDF and compare the complete output before applying this to a document collection.

## What was verified

On 3 October 2026, both backends completed the same one-page [updated sample](https://github.com/user-attachments/files/32982093/synthetic_4138_macroman_quotes_v2.pdf) through Docling's standard pipeline and produced Markdown and structured JSON.

| Backend | Result |
| --- | --- |
| Default threaded docling-parse | All three quoted phrases contained `Ò` and `Ó`. |
| PDFium | All three text lines and all six double quotes were correct. |

PDFium's text extraction method was observed running. Its raw text contained curly quotes; Docling's [page assembler](https://github.com/docling-project/docling/blob/v2.132.0/docling/models/stages/page_assemble/page_assemble_model.py#L160) then applied its normal conversion to straight double quotes. The final Markdown contained:

```text
This Sample Document "Sample Agreement" dated 01/01/2025 "Effective Date".
All terms defined as "Deliverables" apply herein.
```

The checks used Docling 2.132.0 (`docling-slim`), docling-parse 7.22.1, docling-core 2.99.0 and pypdfium2 5.13.0 on Python 3.12/macOS arm64. CPU processing, OCR and table processing remained enabled, using RapidOCR 3.9.2 with ONNX Runtime 1.30.0. The sample contains native text and no tables; this does not establish OCR or table accuracy for other PDFs. These were scripted conversions, with no adoption confirmation from the original reporter.

This is a configuration workaround for that sample. It changes the PDF backend for the whole conversion and has not been tested on the reporter's private document. The related native-parser repair in [docling-parse #370](https://github.com/docling-project/docling-parse/pull/370) was not tested here. Recheck later releases before retaining the workaround.

## Optional coffee

If this saves you some time and you'd like to buy me a coffee, thank you. It's entirely optional; the guide is free.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
