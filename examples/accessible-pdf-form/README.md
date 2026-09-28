# Generate tagged PDF forms with accessible field names

PDFKit 0.20.2 drops the structure parent of a form widget and has no supported option for its alternate name. This source repair restores those options and honors an explicit field font size with the default form font. It also keeps each widget attached to its original page when a multipage document's structure is finalized later.

The regression was reported by Robert-Krueger in [PDFKit #1803](https://github.com/foliojs/pdfkit/issues/1803). The example creates two tagged pages with editable fields, existing reference text, document metadata and an embedded font. The source patch, tests and example are free. The proposed upstream fix is [PR #1805](https://github.com/foliojs/pdfkit/pull/1805); it has not been merged or released.

## Try the source repair

Use Node.js 24. Download this directory, including [the source patch](pdfkit-accessible-forms.patch) and [generate.cjs](generate.cjs). From that directory:

```sh
git clone https://github.com/foliojs/pdfkit.git pdfkit
cd pdfkit
git checkout 563aba49416d9a5444fd8fa09ea2501d3629d2e4
git apply --check ../pdfkit-accessible-forms.patch
git apply ../pdfkit-accessible-forms.patch
node .yarn/releases/yarn-4.16.0.cjs install --immutable
node .yarn/releases/yarn-4.16.0.cjs build
cd ..
node generate.cjs ./pdfkit request-form.pdf
```

This uses a fixed source revision after 0.20.2, including upstream's existing Node bundling repair. It is a source build, not a new stable PDFKit release or a patch for an arbitrary installed version. The generated file is also available as [request-form.pdf](request-form.pdf).

Install [veraPDF](https://docs.verapdf.org/install/) and run:

```sh
verapdf --flavour ua1 request-form.pdf
```

The generated two-page sample should pass the PDF/UA-1 profile. Open it in a PDF form viewer to inspect the fields. Validation after editing is a separate check; see the limits below.

## Use the options

```js
const fieldStructure = doc.struct('Form', { title: 'Request number' });
doc.addStructure(fieldStructure);
doc.formText('requestNumber', 60, 180, 240, 28, {
  alternateName: 'Request number',
  structParent: fieldStructure,
  fontSize: 11,
});
```

`alternateName` writes the field's `/TU` text string. `structParent` connects the widget to its `Form` structure element through an object reference and the parent tree. It is separate from `parent`, which groups form fields. An explicit `fontSize` applies to the default form font too; `0` retains automatic sizing, while omission preserves inherited appearance behavior.

These options alone do not make an arbitrary document accessible. [PDFKit's accessibility guide](https://pdfkit.org/docs/accessibility.html) covers document metadata, language, reading order, tagged content and artifacts. The complete sample is in `generate.cjs`.

For Node bundles, follow [PDFKit's font-registration guidance](https://github.com/foliojs/pdfkit#bundling-for-node). The verification included a local CommonJS esbuild bundle with registered Helvetica metrics; no AWS deployment was performed.

## Verification and limits

The [verification record](verification.json) lists the exact tools and results. Regression tests inspect serialized widget references, distinct page and structure parents, field hierarchy, Unicode names, absent values and explicit zero sizes. The upstream unit and visual suite was run with four workers. A run with unrestricted workers timed out in four visual tests; no test timeout was increased.

The generated sample passes veraPDF's PDF/UA-1 profile. Two programmatic pypdf fill/save/reopen cycles preserved both fields, their matching page widgets, structure links, metadata and reference text. Rendered pages were inspected for correct values and clipping. These are software checks, not human assistive-technology validation or confirmation from the original reporter.

**After pypdf regenerated field appearances, the saved sample failed the font-embedding rule `7.21.4.1-1`.** The example keeps the report's Helvetica form font; the body text uses embedded Roboto. A separate probe with `initForm({ embedFonts: true })` exposed CMap/Unicode validation failures (`7.21.3.1-1` and `7.21.7-1`) and incorrect prefilled appearance rendering in Poppler. This patch does not change that separate font behavior or promise that a viewer's saved file remains PDF/UA conforming. If your workflow validates completed forms, validate the output from your actual editor too. No production document or screen reader was tested.

License: MIT; see [LICENSE](LICENSE). The example uses the font fixture from the upstream source checkout.

## Optional coffee

If this saves you some time and you'd like to buy me a coffee, thank you. It is entirely optional; the repair and example are free.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
