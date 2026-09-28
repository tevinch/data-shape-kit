# Pagella chemical arrows in MathJax

With MathJax 4.1.3 and `mathjax-pagella`, the short-label MathML in [MathJax #3613](https://github.com/mathjax/MathJax/issues/3613) produces **Math output error: Invalid array length** in CHTML output. Giving that stretchy arrow a minimum width avoids the failing short assembly:

```xml
<mo data-mjx-texclass="ORD" stretchy="true" minsize="2em">&#xE409;</mo>
```

Add `minsize="2em"` to this `mo` when generating the MathML, or to the generated MathML before MathJax typesets it. Keep the surrounding `mover`, label and other configuration unchanged. [MathML defines `minsize`](https://www.w3.org/TR/mathml-core/#operator-fence-separator-or-accent-mo) as the minimum size of a stretchy operator. This makes the short arrow wider; longer labels can still stretch it further.

## Try the complete example

Download [index.html](index.html) and open it in a browser with network access. It loads MathJax 4.1.3 and its fonts from jsDelivr and includes the report's complete configuration, including Pagella, `mhchem`, `ui/safe`, scale and skipped tags. No build or package installation is needed.

1. Open the file with its default minimum width. The two harpoons and `x` should appear, and the status should show `passed: true`.
2. Click **Use a longer label**. The arrow should expand under “reaction conditions”.
3. Click **Repeat original formula** twice. The `x` arrow should return without errors; the nearby formula and paragraph should remain intact.
4. Click **Original MathML** to compare the unchanged input. In the tested version it displays the reported error and `passed: false`. **With minsize** restores the workaround.

If local-file navigation behaves differently in your browser, serve this directory with `python3 -m http.server 8000` and open `http://localhost:8000/`.

## What was checked

The browser verification used Chrome on macOS, with software-operated controls and inspection of the rendered page. It reproduced the original failure, then checked initial rendering, a longer label and two subsequent short-label renders. The surrounding paragraph, separate `y = 2` formula and skipped code text were retained. The checks independently require the actual Pagella output font, loaded `mhchem` and active `ui/safe`; an unrun startup or missing arrow does not pass. Details are in [verification.json](verification.json).

A separate diagnostic probe of `ChtmlMo.createPart()` recorded `W = -0.5733175336435923`, `Wx = 0.273`, and a repeated-part count of `-1` for the original input. MathJax 4.1.3 computes `Math.min(Math.ceil(W / Wx) + 1, 500)` before constructing an array. Explicitly adding the mhchem font extension did not remove this failure; the extension was already loaded.

This is a targeted MathML workaround, not an upstream source fix or a guarantee for every chemical arrow. It has not been checked in the reporter's Firefox/Ubuntu environment or confirmed by the reporter. It does not repair the separate speech interpretation of private-use arrow characters. The example does not disable `ui/safe` or replace the requested font.

License: MIT; see [LICENSE](LICENSE). MathJax and its fonts retain their own licenses.

## Optional coffee

If this saves you some time and you'd like to buy me a coffee, thank you. It is entirely optional; the guide and example are free.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
