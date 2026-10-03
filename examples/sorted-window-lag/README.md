# Keep sorted lag charts visible

For a Vega-Lite window containing only `lag` operations, add `"ignorePeers": true` to keep a sorted chart working when a following frame reaches beyond the last record. [`spec.json`](spec.json) is a complete configuration with two 12-row lags, descending date order and the original `[12, null]` frame.

This example addresses the blank chart in [Vega-Lite #9940](https://github.com/vega/vega-lite/issues/9940), reported by PavelAdamCR with Deneb 2.0.0.0. The error reproduces with the stable Vega 6.4.0 and Vega-Lite 6.4.3 versions used by that Deneb release. The checks here use an invented dataset outside Power BI; reporter adoption has not been confirmed.

## Apply the configuration

Keep your existing dataset, encodings and other transforms. In the window transform that contains the two `lag` operations, add the last property below:

```json
{
  "window": [
    {"field": "date", "param": 12, "op": "lag", "as": "date_PY"},
    {"field": "mKPI", "param": 12, "op": "lag", "as": "mKPI_PY"}
  ],
  "frame": [12, null],
  "sort": [{"field": "date", "order": "descending"}],
  "ignorePeers": true
}
```

The [window documentation](https://vega.github.io/vega-lite/docs/window.html) specifies that `lag` ignores the frame and peer expansion. Consequently, this setting preserves both lag results for this transform while avoiding the faulty boundary comparison. Sorting by `__row__` descending works too. A lag of 12 means 12 preceding records in the chosen order; it does not automatically mean the same calendar month last year, especially with descending order or missing months.

**Scope:** Do not apply this indiscriminately to a transform that also contains frame-sensitive aggregates, `first_value`, `last_value` or `nth_value`. Their results can depend on peers. If equal sort keys exist, supply the tie-break order that your own data requires; the configuration does not invent one. In Deneb, try the change in your existing visual and check both lag fields in its data view, including after a filter or data refresh.

## Run the checks

With Node.js 22.12+ and npm, run in this directory:

```sh
npm ci --ignore-scripts
npm test
```

The pinned runtime check first reproduces both original sorted failures. It then verifies all 24 bars and both lag values for no sort, row-descending sort and date-descending sort, before and after replacing the dataset in reversed input order. It checks unchanged input values as well as computed fields. SVGs and results are written to `verification/`. The container-width specification is retained. Node has no browser container or resize event and uses a fallback size; the check permits only the corresponding environment warning.

For an interactive comparison, serve this directory with a local HTTP server, for example:

```sh
python3 -m http.server 8797 --bind 127.0.0.1
```

Open [the local example](http://127.0.0.1:8797/), switch among the sort options, compare **Run original** and **Run with ignorePeers**, then use **Reverse input and refresh**. The table shows both lag fields. All runtime assets come from the installed packages; the sample contains no real report data.

## Source correction

The source fix is proposed in [Vega PR #4357](https://github.com/vega/vega/pull/4357). It has not been merged or released.

[`window-frame.patch`](window-frame.patch) contains the source correction and regression tests for Vega at commit `045d12611007cd65ae5ce68e4179d4ee2f150ef8`. In `vega-transforms/src/Window.js`, it prevents comparisons at `data.length` and `-1` when an empty frame passes a partition boundary. Valid peer expansion remains enabled, and the original specification needs no configuration change when using the corrected runtime.

Apply the patch to a checkout of that Vega commit with `git apply`, then follow [Vega's build instructions](https://github.com/vega/vega/blob/main/CONTRIBUTING.md). This is a source correction for review, not an official released build or a replacement Deneb visual. Replacing an application's npm dependency does not update Vega bundled inside Power BI's Deneb visual. The lag-only configuration above is the immediately usable route for that report.

The focused window tests, full Vega test suite, type checks, lint and production build passed. The new regression tests cover both empty-frame boundaries, equal sort keys, separate partitions, sorting changes, clearing and reinserting data, and a descending 12-row lag. The built corrected runtime also rendered all 24 bars and calculated both lag fields correctly with the original frame and default peer handling, for all three sort cases and a reversed-input refresh.

A software-operated Chrome check of the stable-runtime example reproduced both original sorted failures, then verified all 24 bars and both lag fields with the configuration for all three sort modes, including two consecutive reversed-input refreshes. These checks do not establish human manual validation, Power BI host behavior or reporter adoption.

## License

The configuration and example checks are MIT licensed under this repository's [LICENSE](../../LICENSE). The original minimal specification is credited above. The Vega source patch retains the [upstream BSD license](LICENSE.vega); dependencies retain their own licenses.

## Optional coffee

The example and checks are free. If they save you time and you would like to buy me a coffee, a small contribution is welcome; there is no obligation.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
