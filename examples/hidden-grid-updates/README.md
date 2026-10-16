# Updating a hidden Swiper Grid

A responsive Swiper Grid can mount inside a hidden tab or panel before its data arrives. In 14.3.0, an update in that state can throw from `updateActiveIndex` and interrupt the page.

The [source correction](https://github.com/nolimits4web/swiper/pull/8243) defers geometry and index calculations until Swiper has a size. It keeps the normal update event so modules can reconcile settings while hidden. Once the container becomes measurable, normal resizing and navigation continue. Explicit `width` and `height` settings retain their existing behavior.

This source contribution is awaiting upstream review and release. See [the original report](https://github.com/nolimits4web/swiper/issues/8240) for the affected workflow.

## Try the source and regressions

Use Node.js 20.19 or newer. The commit below includes the source change and tests:

```sh
git clone https://github.com/tevinch/swiper.git
cd swiper
git checkout 81c1f546621a05a81f13a8606207133ced7d3325
npm ci --ignore-scripts
npm run build:prod
npm run grid-hidden-test
```

For the complete project checks, run `npm test`. To try the built package in a separate application, run `npm install --install-links /absolute/path/to/swiper/dist` from that application. The [install-links option](https://docs.npmjs.com/cli/v11/commands/npm-install#install-links) installs a package copy so it can use the application's React dependency. Keep your existing Swiper imports and Grid options. Test your application before replacing its installed package.

The change does not require a fixed-width workaround, disabling Grid, or removing slides. The official [width and height options](https://swiperjs.com/swiper-api) are useful when a fixed size is intended, but they disable responsiveness in the corresponding dimension.

## Verification and limits

The full project test command passed, including eight new DOM/React regressions. Nine Chromium 151 scenarios passed, covering hidden React content updates, automatic reveal, actual row/column geometry, next/previous navigation to the end and back, dragging, 600→650→1000px responsive resizing, and another hidden update that removes content. Layout and state were compared with an initially visible control using the same options. Explicit width/height, a nonzero initial slide, and changing Grid to one row while hidden were also checked. One extra scenario uses explicit Grid settings at a breakpoint; the primary matrix retains the original options without a breakpoint map. The existing Browserslist data-age warning remains.

The regression suite uses real Swiper and React code with explicitly simulated dimensions in happy-dom. Browser checks separately exercise actual layout. Android WebView, the original production application and original-user adoption have not been verified. Upstream review and release status are separate from these local results.

The fix keeps the supported Grid behavior; it does not add support for combinations that Swiper documents as unsupported, such as Grid with Virtual Slides. Source and tests retain Swiper's MIT license.

## Optional coffee

If this saves you time, you're welcome to buy me a coffee. Entirely optional; the source and tests are free.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
