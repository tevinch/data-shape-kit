# Pagella chemical arrows in MathJax

With MathJax 4.1.3 and `mathjax-pagella`, the short-label chemical arrow in [MathJax #3613](https://github.com/mathjax/MathJax/issues/3613) produces **Math output error: Invalid array length** in CHTML output. This also happens when MathJax generates the MathML from `\mhchemxRightleftharpoons x` and then typesets that MathML.

## Correct the font data once

[MathJax maintainer Davide P. Cervone identified the missing minimum widths](https://github.com/mathjax/MathJax/issues/3613#issuecomment-5871933548) for U+E409 and U+E40A. The arrows are assembled from several characters, but their font data does not specify the smallest possible assembly.

Use the maintainer's CHTML configuration correction before loading MathJax:

```js
window.MathJax = {
  output: {
    font: 'mathjax-pagella',
    fontExtensions: ['mathjax-mhchem']
  },
  loader: {
    '[mathjax-mhchem-extension]/chtml': {
      ready() {
        const font = Array.from(Object.values(MathJax._.output.fonts[MathJax.config.output.font].chtml_ts))[0];
        font.defaultDelimiters[0xE409].min = 1.3;
        font.defaultDelimiters[0xE40A].min = 1.3;
      }
    }
  }
};
```

Merge these properties into your existing configuration; retain other font extensions, loader settings, TeX packages, `ui/safe`, scale and skipped tags. If this exact loader component already has a `ready` callback, combine the correction with that callback rather than replacing its work. Remove the earlier U+E409 pre-filter supplied by this example.

The correction runs when the font extension becomes ready. It changes the two font minima, without rewriting the TeX, generated MathML or operator attributes. It supersedes this guide's earlier per-expression `minsize="2em"` workaround. No per-expression output filter is needed.

This is a temporary configuration correction tested with **MathJax 4.1.3, Pagella and CHTML**. It accesses MathJax's internal font module, so recheck it when upgrading. The maintainer's linked comment also includes SVG configuration; SVG is not covered by this example's verification.

## Run the complete generation example

Download [the source ZIP](https://raw.githubusercontent.com/tevinch/data-shape-kit/pagella-chemical-arrow-v3/downloads/pagella-chemical-arrow-v3.zip), extract it and open **generated-mathml.html**. It loads MathJax and fonts from jsDelivr, so network access is required. No package installation or build is needed. Alternatively, serve the directory with `python3 -m http.server 8000` and visit `http://localhost:8000/generated-mathml.html`.

1. The page calls `MathJax.tex2mmlPromise()` and passes its unchanged result to `MathJax.typesetPromise()`. The arrow and `x` appear, and the checks show `passed: true`.
2. Click **Generate longer label**, then **Regenerate short label** twice. Every operation generates and renders new MathML.
3. **Render TeX directly** checks the TeX input path. **Render explicit 4em minimum** and **Render inherited 4em minimum** check existing larger widths.
4. **Generate U+E40A arrow** checks the other affected character, generated from `\mhchemxLeftrightharpoons x`.
5. **Original configuration** disables the data correction and reproduces the error. **With font-data correction** restores it.

The page retains the report's full configuration. Its diagnostic checks inspect the actual input parser, conversion count, font-ready count, both font minima, operator attributes, visible arrows and labels, nearby content, scale, Pagella, `mhchem` and `ui/safe`. The font callback must run exactly once across repeated renders. The diagnostics inspect the expression trees after each operation; that inspection is test code, not part of the configuration to copy into your application.

## Verification and limits

Software-operated Chrome on macOS checked the initial arrow, a long label, two subsequent short labels, direct TeX input, direct/inherited `4em` minima and U+E40A. The original configuration remains a failing control. These checks are not human manual testing, Firefox/Ubuntu confirmation, or confirmation that the original reporter has adopted the correction. See [verification.json](verification.json) for the dated results.

The default generated MathML still has no added `minsize`, and its internal operator minimum remains `0em`; the required minimum now comes from font data. This does not repair the separate speech interpretation of private-use arrow characters or establish compatibility with every font and renderer.

[index.html](index.html) retains the earlier static-MathML `minsize="2em"` comparison for reproducing that workaround. Its older verification, and the earlier filter verification, are historical results. Prefer the font-data correction above for new use.

License: MIT; see [LICENSE](LICENSE). MathJax and its fonts retain their own licenses. The font-data correction is credited to Davide P. Cervone's linked explanation.

## Optional coffee

If this saves you some time and you'd like to buy me a coffee, thank you. It is entirely optional; the guide and example are free.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
