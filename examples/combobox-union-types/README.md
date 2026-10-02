# Combobox union callback types

A creatable Combobox can contain both strings and option objects. In Headless UI React 2.2.10, forwarding a boolean `multiple` prop can make TypeScript reject correctly typed `by` and `virtual.disabled` callbacks. This example reproduces [the original report by dimazuien](https://github.com/tailwindlabs/headlessui/issues/3897) and provides a small, reversible declaration correction.

The correction follows the report's suggestion to apply `NoInfer` after the array type transformation. It changes three declarations for `by`, `virtual.options` and `virtual.disabled`. It preserves runtime code, the shared `EnsureArray` helper and strict callback checking. It is unofficial and version-specific.

## Reproduce and try the correction

Clone this repository, enter this directory and run:

```sh
npm ci --ignore-scripts
npm run check
```

The unmodified package reports two TS2322 errors in `index.tsx`, on the comparator and disabled callback. The fixture uses the real installed package, React 18.3.1 and TypeScript 5.9.2 under `strict`.

Review [the patch](headlessui-react-2.2.10.patch), then apply it from this directory:

```sh
git apply --check headlessui-react-2.2.10.patch
git apply headlessui-react-2.2.10.patch
npm run check
```

The same consumer now compiles without casts. To undo the correction:

```sh
git apply --reverse headlessui-react-2.2.10.patch
npm run check
```

The original two errors return. In your application, copy the patch to the project root and use those apply commands only with exactly `@headlessui/react@2.2.10` in `node_modules`. Check the diff first. Dependency reinstalls overwrite this local change; use your package manager's supported patch mechanism if you decide to retain it. Remove the patch after an official release resolves the issue.

## Source contribution and validation

[Upstream pull request #3900](https://github.com/tailwindlabs/headlessui/pull/3900) contains the source correction and compiler-backed regression. It is awaiting review; this is not an official release.

The regression compiles actual exported JSX with primitive/object and object/object unions, boolean and literal multiple modes, and inferred array values. Invalid numeric callbacks/options, narrower callbacks and option-driven type widening remain rejected. The repository's TypeScript 5.4.3 compiler test fails before the change and passes afterward. The real 2.2.10 consumer also passes with the declaration patch under TypeScript 5.9.2, and the unchanged consumer compiles against the packed source correction. Applying and reversing the patch restores the expected pass/fail results.

The full source test run passed 56 suites, 2,046 tests and 100 snapshots, with 36 skipped. An earlier unchanged Vue transition timing snapshot failed and then passed in that full run. These are compiler and scripted test results; no original-reporter adoption or human browser validation is claimed. This corrects the reported typing problem; it does not change selection behavior or promise to fix other generic-type limitations.

Headless UI is MIT licensed; see [the included license](LICENSE.headlessui).

## Optional coffee

The source correction and guide are free. If they save you time and you'd like to buy me a coffee, thank you. It is entirely optional.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
