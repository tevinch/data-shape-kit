# DOCX wrapper examples

These five small documents separate the XML cases from [Mammoth issue 490](https://github.com/mwilliamson/mammoth.js/issues/490). Each contains only the reported text and its wrapper. The moved-text example includes both the old and new positions.

With Mammoth 1.13.0, moved text and both custom XML examples produce the requested HTML without warnings. The direction embedding and override examples still produce an empty string and an unrecognised-element warning. See `results.json` for the exact output and `expected-html.json` for the requested text-preserving HTML.

To rerun in this directory with Node.js:

```sh
npm install --ignore-scripts --no-audit --no-fund mammoth@1.13.0
node read-documents.cjs
```

The recorded run used Node.js 24.19.0 on macOS arm64. These are programmatically generated fixtures, not original Microsoft Word files supplied by the reporter. Each was also opened through LibreOffice's document renderer; the wrapper text remained visible, and the moved text appeared as tracked changes. No human Microsoft Word validation was performed. These examples check text preservation, not complete bidirectional layout fidelity, and contain no proposed parser change.

The fixtures and reproduction script may be used or modified under the BSD 2-Clause license in `LICENSE` for investigating this issue and adding regression tests.
