# Double-quote decoding in Docling PDFs

The updated embedded-TrueType/MacRoman sample in [Docling #4493](https://github.com/docling-project/docling/issues/4493) displays double quotes correctly but exports `ÒSample AgreementÓ`. A native-parser preview now decodes that sample correctly while retaining the threaded backend. The PDFium configuration below is a released alternative for applications that can switch backends.

**The original reporter's full workflow is still unverified.** On 5 October, [the reporter clarified](https://github.com/docling-project/docling/issues/4493#issuecomment-5998382391) that their application relies on the threaded backend for word-level tokens/cells, bounding boxes and fillable PDF processing. They cannot use the PDFium switch. The public sample has no form fields, so it cannot establish that their fillable-PDF workflow works.

## Native-parser preview checked on 12 October 2026

[docling-parse #370](https://github.com/docling-project/docling-parse/pull/370), at commit `f721ba4f75a5678b13178df90e4f6f9524772a37`, fixed the quoted text in the [updated sample](https://github.com/user-attachments/files/32982093/synthetic_4138_macroman_quotes_v2.pdf) during scripted checks:

| Check | Released parser 7.22.1 / 7.22.2 | PR #370 preview |
| --- | --- | --- |
| Sequential and threaded parsing, with sanitization on and off | Three `Ò` and three `Ó` characters | All six quotes decoded as straight double quotes |
| Materialized character, word and line cells | 148 characters, 19 words, 3 lines | Same counts; complete text correct at all three levels |
| Cell coordinates | Baseline | Every character, word and line rectangle unchanged from released 7.22.1 |

The preview also passed a check through Docling's actual `InputDocument` and `ThreadedDoclingParseDocumentBackend`: all three text lines, 19 word cells, text queries by rectangle and a 612 × 792 page image were available with default backend options. That check used `docling-slim` 2.138.0 and docling-core 2.101.1 on Python 3.12/macOS arm64. It did not run the full conversion pipeline or a form-fill operation. There is no confirmation from the reporter's application.

The tested wheel came from the official [CI run](https://github.com/docling-project/docling-parse/actions/runs/36745616541), artifact [`python-package-distributions-py3.12-macosx_arm64`](https://github.com/docling-project/docling-parse/actions/runs/36745616541/artifacts/11295697082). Its archive SHA-256 was `7e712d5967c2631026de40242b3de2b414c6d8ee51b9678e74f1f57f3d1dc517`. The contained wheel still reports version **7.22.1**, but it is the PR build; installing the PyPI release with that version does not provide this repair. Choose an artifact matching your own Python and platform if evaluating the preview in a separate environment.

The PR remains unmerged and the overall CI run includes failed checks and wheel jobs. A successful sample check is not release approval. Recheck the PR and current releases before changing an existing installation.

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

## Earlier full-pipeline comparison

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

This is a configuration workaround for that sample. It changes the PDF backend for the whole conversion and has not been tested on the reporter's private document. Recheck later releases before retaining the workaround.

## Optional coffee

If this saves you some time and you'd like to buy me a coffee, thank you. It's entirely optional; the guide is free.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
