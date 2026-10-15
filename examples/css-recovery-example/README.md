# Preserve CSS declarations during error recovery

With `errorRecovery: true`, Lightning CSS 1.33.0 can remove valid declarations that appear before an invalid nested at-rule. In [Lightning CSS #1358](https://github.com/parcel-bundler/lightningcss/issues/1358), this causes existing styles to disappear when the compiler recovers from nested `@keyframes` or `@font-face` rules.

This directory contains a small reproduction and a [source patch](preserve-declarations.patch) against upstream commit [`ab14f90df45b1a94c6c10a3d9ca16b39d09f67e0`](https://github.com/parcel-bundler/lightningcss/commit/ab14f90df45b1a94c6c10a3d9ca16b39d09f67e0). The patch preserves successfully parsed sibling declarations. It still discards the invalid nested rule and reports a warning; strict parsing still rejects the input. This is a pending source fix, not a published npm fix.

The [source PR #1374](https://github.com/parcel-bundler/lightningcss/pull/1374) is open for review at head `7b8287f21e2f30587e552c40c39f898eacab3366`.

## Reproduce the loss

The included [`a.css`](a.css) keeps the original declaration order:

```css
.a{color:red;width:1px;@keyframes k{from{opacity:0}}height:2px}
```

Run the example in its own directory with Node.js and npm:

```sh
npm ci --ignore-scripts --no-audit --no-fund
node reproduce.cjs
```

The dependency is pinned to Lightning CSS **1.33.0**. With `minify: true` and `errorRecovery: true`, that release produces:

```css
.a{height:2px}
```

The valid `color:red` and `width:1px` declarations are missing. The patch's Rust regression expects:

```css
.a{color:red;width:1px;height:2px}
```

The invalid `@keyframes` is absent in both outputs. The warning remains `Unknown at rule: @keyframes`, at line 1, column 36. The script also checks that `errorRecovery: false` throws, and prints the module it loaded so a comparison can identify the compiler being tested. Add `--expect-preserved` to make declaration loss fail the command:

```sh
node reproduce.cjs --expect-preserved
```

That command fails on the checked 1.33.0 release. A clean consumer installation with npm 10.7.0 and Node.js 24.19.0 completed with scripts disabled. The default reproduction, expected failure and source-addon comparison were then checked on both Node.js 24.19.0 and 18.20.4. The machine-readable [verification summary](verification.json) records the results.

## Apply the source patch

Use a separate upstream checkout, keeping this example directory alongside it. The commands below assume this directory is named `css-recovery-example`:

```sh
git clone https://github.com/parcel-bundler/lightningcss.git
cd lightningcss
git checkout --detach ab14f90df45b1a94c6c10a3d9ca16b39d09f67e0
git apply --check ../css-recovery-example/preserve-declarations.patch
git apply ../css-recovery-example/preserve-declarations.patch
cargo test --locked
```

The patch changes only `src/parser.rs`, `src/lib.rs` and `node/test/transform.test.mjs`: it removes two declaration-vector clears and adds regression tests. It retains the existing recovery setting, error collection and nested at-rule legality checks.

The new regression failed before the parser change and passed afterward. It checks final minified CSS and warning counts for normal and `!important` declarations, errors at different positions, repeated errors, a following style rule, an invalid declaration and nested media content. It also checks strict rejection and an unaffected legal media rule.

Recorded source checks on macOS arm64:

| Command | Result |
| --- | --- |
| `cargo test --locked -- --test-threads=1` | 125 unit, 5 integration and 7 documentation tests passed |
| `cargo test --locked --all-features -- --test-threads=1` | 126 unit, 33 integration and 8 documentation tests passed |
| `cargo fmt --all -- --check` | Passed |
| `npm test` on Node.js 24.19.0; `uvu node/test` on 18.20.4 | All 82 Node tests passed on each runtime |
| `tsc -p node/tsconfig.json --types node` | Passed |

The Rust test commands used `RUSTUP_TOOLCHAIN=stable`, `CARGO_PROFILE_DEV_DEBUG=0`, `CARGO_PROFILE_TEST_DEBUG=0` and `CARGO_INCREMENTAL=0`. Formatting used `RUSTUP_TOOLCHAIN=stable`. That installed stable compiler was **Rust 1.98.1**. The checkout's toolchain file pins **1.96.0**; that pinned compiler was not used for these checks. An existing unused `HashMap` import warning remains under default features.

For the Node binding, follow the upstream [build and test instructions](https://github.com/parcel-bundler/lightningcss/blob/ab14f90df45b1a94c6c10a3d9ca16b39d09f67e0/CONTRIBUTING.md). To evaluate a locally built native addon with this example, pass its absolute `.node` path explicitly:

```sh
node ../css-recovery-example/reproduce.cjs /absolute/path/to/built-addon.node --expect-preserved
```

The normal Node entrypoint prefers an installed platform package before its local addon fallback. Passing the built file avoids accidentally comparing the released binary again. The example checks the exact recovered CSS, warning details and strict-mode failure.

The checked source addon preserved all three declarations for the included sample with `minify` both `true` and `false`. Both modes retained the same warning, and strict mode rejected the invalid input. Its SHA-256 is `cc228629688522b638ee770b5b280cf024ebd9af4fa11ecca10660f0feae8a34`. The clean consumer's explicit-addon assertion passed on both Node versions. The addon is not included here; build it from the patched source. These scripted checks do not establish validation in the original reporter's application.

## Tailwind and Vite acceptance

A synthetic application using Node.js 24.19.0, Tailwind CSS 4.3.3 and Vite 8.3.4 passed **13/13 acceptance cases** with the source addon: one direct matrix, three development phases, eight production operations and an optimizer-omission control that correctly rejected the missing work. Across all eight production operations, the source addon preserved the preceding styles while the released dependency graph lost them. These covered original, changed and restored input in watch builds plus a clean repeat, with CSS minification both enabled and disabled. Recovery warnings remained present.

A subsequent development-readiness synchronization adjustment was checked with development-only reruns: the released and source configurations each passed **3/3** original/changed/restored phases. The production and direct results above come from the completed full runs; unchanged production cases were not repeated after that development-only adjustment.

Chrome 155.0.8059.41 was operated by software to check emitted CSS and computed styles. This was a synthetic fixture, with no human manual or original-reporter application validation. For this source comparison, the built addon was selected at Tailwind's existing Lightning CSS 1.32.0 boundary; Vite's separate 1.33.0 compiler remained unchanged. Published npm packages were not changed by these checks.

## Keep the application input and settings intact

Evaluate the patch with your existing stylesheet and compiler options, including error recovery, optimization, targets and nesting settings. Keep the original input and compare the complete generated CSS. Disabling optimization or recovery changes the workflow being tested.

Tailwind CSS 4.3.3's `@tailwindcss/node` dependency pins Lightning CSS **1.32.0**. Updating a separately installed `lightningcss` package does not establish that Tailwind uses the patched compiler. Check the compiler actually resolved by the host before evaluating a source build.

The patch does not turn invalid nested at-rules into valid CSS or move them to the top level. If you instead edit the stylesheet, place each rule only where its intended semantics permit; hoisting an invalid rule is not automatically equivalent to preserving the original behavior.

Source changes retain the upstream [MPL-2.0 license](LICENSE). The example and guide are available free of charge.

## Optional coffee

If this saves you some time and you'd like to buy me a coffee, thank you. It's entirely optional; the guide and patch are free.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
