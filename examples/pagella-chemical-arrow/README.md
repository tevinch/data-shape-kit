# Pagella chemical arrows in MathJax

With MathJax 4.1.3 and `mathjax-pagella`, the short-label MathML in [MathJax #3613](https://github.com/mathjax/MathJax/issues/3613) produces **Math output error: Invalid array length** in CHTML output. The same failure occurs when MathJax generates the MathML from `\mhchemxRightleftharpoons x` and then typesets that MathML.

## When MathJax generates your MathML

Add a CHTML pre-filter to your existing configuration. It sets the minimum width in the internal tree just before output, so your TeX and generated MathML stay unchanged:

```js
chtml: {
  scale: 1.25,
  preFilters: [({math}) => {
    math.root.walkTree(node => {
      if (node.kind !== 'mo' || node.getText() !== '\uE409') return;
      const attributes = node.attributes;
      const stretchy = attributes.get('stretchy');
      if (stretchy !== true && stretchy !== 'true') return;
      if (attributes.isSet('minsize') || attributes.isSet('maxsize')) return;
      attributes.set('minsize', '2em');
    });
  }]
}
```

Merge this into the `chtml` block before loading MathJax. If you already have `preFilters`, append this function to that array. Keep your other settings, including `output.font: 'mathjax-pagella'`, `mhchem` and `ui/safe`. This uses MathJax's [documented output filters](https://docs.mathjax.org/en/latest/advanced/synchronize/filters.html); it changes only the stretchy U+E409 operator when neither size bound was supplied directly or inherited from an enclosing MathML element.

The short arrow becomes wider; longer labels still stretch it further. Directly set or inherited `minsize` and `maxsize` values are left alone, so a conflicting explicit size can still require your attention. This configuration is for CHTML with Pagella; it does not change saved MathML, server-side conversion, other fonts or other output renderers.

### Run the generation example

Download [the complete source ZIP](https://raw.githubusercontent.com/tevinch/data-shape-kit/pagella-chemical-arrow-v2/downloads/pagella-chemical-arrow-v2.zip), extract it and open **generated-mathml.html**. It loads MathJax from jsDelivr, so network access is required. The same directory contains [the helper](pagella-arrow-minimum.js) and [the page source](generated-mathml.html).

1. The page calls `MathJax.tex2mmlPromise()` and passes its unchanged result to `MathJax.typesetPromise()`. The arrow and `x` appear; the checks show `passed: true` and `sourceMinimum: null`.
2. Click **Generate longer label**, then **Regenerate short label** twice. Each click generates new MathML and completes rendering.
3. **Render TeX directly** exercises the other input path. **Render explicit 4em minimum** and **Render inherited 4em minimum** demonstrate that existing widths are preserved.
4. **Original configuration** disables the filter and reproduces the original error. **With automatic minimum** restores it.

The page retains the report's full configuration and checks actual conversion calls, filter execution, internal operator attributes, visible arrows and labels, nearby content, the active Pagella font, `mhchem` and `ui/safe`. These checks were run through software-operated Chrome on macOS. They are not human manual testing or Firefox/Ubuntu confirmation. The reporter's [follow-up](https://github.com/mathjax/MathJax/issues/3613#issuecomment-5869616813) prompted this generated-input example; it is not evidence that they have adopted it.

## If you already control the MathML

Giving the same stretchy arrow a minimum width directly also avoids the failing short assembly:

```xml
<mo data-mjx-texclass="ORD" stretchy="true" minsize="2em">&#xE409;</mo>
```

Add `minsize="2em"` to this `mo` when generating the MathML, or to the generated MathML before MathJax typesets it. Keep the surrounding `mover`, label and other configuration unchanged. [MathML defines `minsize`](https://www.w3.org/TR/mathml-core/#operator-fence-separator-or-accent-mo) as the minimum size of a stretchy operator. This makes the short arrow wider; longer labels can still stretch it further.

### Static MathML comparison

Download [index.html](index.html) and open it in a browser with network access. It loads MathJax 4.1.3 and its fonts from jsDelivr and includes the report's complete configuration, including Pagella, `mhchem`, `ui/safe`, scale and skipped tags. No build or package installation is needed.

1. Open the file with its default minimum width. The two harpoons and `x` should appear, and the status should show `passed: true`.
2. Click **Use a longer label**. The arrow should expand under “reaction conditions”.
3. Click **Repeat original formula** twice. The `x` arrow should return without errors; the nearby formula and paragraph should remain intact.
4. Click **Original MathML** to compare the unchanged input. In the tested version it displays the reported error and `passed: false`. **With minsize** restores the workaround.

If local-file navigation behaves differently in your browser, serve this directory with `python3 -m http.server 8000` and open `http://localhost:8000/`.

## Earlier static-input verification

The browser verification used Chrome on macOS, with software-operated controls and inspection of the rendered page. It reproduced the original failure, then checked initial rendering, a longer label and two subsequent short-label renders. The surrounding paragraph, separate `y = 2` formula and skipped code text were retained. The checks independently require the actual Pagella output font, loaded `mhchem` and active `ui/safe`; an unrun startup or missing arrow does not pass. Details are in [verification.json](verification.json).

A separate diagnostic probe of `ChtmlMo.createPart()` recorded `W = -0.5733175336435923`, `Wx = 0.273`, and a repeated-part count of `-1` for the original input. MathJax 4.1.3 computes `Math.min(Math.ceil(W / Wx) + 1, 500)` before constructing an array. Explicitly adding the mhchem font extension did not remove this failure; the extension was already loaded.

Both examples are targeted workarounds, not an upstream source fix or a guarantee for every chemical arrow. They have not been checked in the reporter's Firefox/Ubuntu environment or confirmed by the reporter. They do not repair the separate speech interpretation of private-use arrow characters. The examples do not disable `ui/safe` or replace the requested font.

License: MIT; see [LICENSE](LICENSE). MathJax and its fonts retain their own licenses.

## Optional coffee

If this saves you some time and you'd like to buy me a coffee, thank you. It is entirely optional; the guide and example are free.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
