# Resize fixed columns in a virtual Naive UI table

In Naive UI 2.45.3, resizing fixed columns in a horizontally virtualized table can leave gaps, overlap adjacent columns or change the displayed width of an untouched neighbour. [Issue #8229](https://github.com/tusen-ai/naive-ui/issues/8229) includes a 1000-row, 1000-column example with two fixed columns on each side.

The source correction keeps resized widths consistent across the fixed offsets, virtual positions, header cells, body cells and total scroll width. It also places the virtual middle cells inside one spanning table cell, so browser table layout does not introduce an extra column slot. Width clamping is synchronized before the next scroll, while genuine header and body input remains effective.

## Try the source correction

This is a source contribution under review, not an official Naive UI release. Use a separate checkout to build it, then verify your application in a test branch. Node.js 24 and pnpm 11 were used for the checks below.

```sh
git clone --single-branch --branch fix-resizable-fixed-columns https://github.com/tevinch/naive-ui.git
cd naive-ui
git checkout 29e9efd32d8f585a5eab9fac1518157d255d16ba
pnpm install --ignore-scripts
pnpm run build:package
pnpm pack --out ./naive-ui-local.tgz
```

The commit is pinned so a later branch update does not silently change the source. Install the resulting local archive in your application with `pnpm add --ignore-scripts /absolute/path/to/naive-ui-local.tgz`. Keep your application's Vue version and existing DataTable settings. The archive retains the upstream package name/version; keep the local archive and lockfile entry together, and return to an official release once the fix is available.

A smaller review route is to inspect [the source PR](https://github.com/tusen-ai/naive-ui/pull/8230), including its regression tests. No application wrapper, remount, data replacement or column-definition mutation is required.

## Verify your table

Start with both left and right fixed columns at their configured widths. Shrink the first and last fixed columns before growing anything. Check that untouched neighbours retain their original widths. Scroll horizontally to the middle and resize a visible middle column. Grow and shrink all four fixed columns, scroll to the far right and a distant row, then return and repeat. Column content, header/body alignment and click handlers should remain usable.

The included browser tests additionally cover only-left, only-right and no-fixed configurations, resize limits, row hover styling, scrolling back immediately after a width clamp, and a header-origin scroll after a width-only update.

Checks on 2026-10-01, Node.js 24.19.0 / pnpm 11.19.0 / macOS:

- 74 DataTable component tests and 16 Chromium browser tests pass.
- Code/type checks, the complete package build, ESM/UMD smoke tests and the build artifact check pass.
- The full coverage run passes 1,246 tests; one unchanged locale test exceeds its default five-second limit. The locale file passes all three tests when run alone with coverage and the same timeout. Existing jsdom canvas and ResizeObserver teardown notices remain in the logs.
- The packed archive installs in a separate Vue 3.5.43 project. Chrome pointer checks on that installed package confirm shrinking both fixed edges and scrolling while untouched neighbours keep their width and header/body content stays aligned.

The source checkout also passed software-operated pointer checks for repeated resizing, the far-right columns and row 500. The original column definitions and data remain unchanged. Upstream dependency ranges can resolve newer packages when building later; run your application's checks before adopting the archive.

These are scripted tests and software-operated browser checks, not human manual validation or confirmation from the original reporter. The ordinary-table report #8226 was not reproduced and is not claimed fixed. The correction preserves the existing documented limitations of horizontal virtualization, including unsupported grouped headers.

Naive UI's source and this guide are MIT licensed. See the [upstream license](https://github.com/tusen-ai/naive-ui/blob/main/LICENSE).

## Optional coffee

The solution and source are free. If they save you time and you'd like to buy me a coffee, thank you—it's entirely optional.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
