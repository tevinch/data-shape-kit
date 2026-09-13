# Keep local constant values intact in Metro release bundles

A production bundle can turn arithmetic on a destructured local constant into `NaN`, or change numeric addition into a string. This example follows **jormaj's** report in [Metro #1927](https://github.com/react/metro/issues/1927) and provides a small source workaround with reproducible bundle checks.

## Change the affected binding

For the simple object in the report, replace:

```js
const SHAPE = { lo: 80, hi: 85, scale: 2.8 };
function span() {
  const { lo, hi, scale } = SHAPE;
  return (hi - lo) * scale;
}
```

with direct property reads, in the same order:

```js
const SHAPE = { lo: 80, hi: 85, scale: 2.8 };
function span() {
  const lo = SHAPE.lo;
  const hi = SHAPE.hi;
  const scale = SHAPE.scale;
  return (hi - lo) * scale;
}
```

Likewise, change `const { e } = O` to `const e = O.e`. For an alias such as `const { e: amount } = O`, use `const amount = O.e`. Keep the original calculation and release build settings.

These reads avoid the incorrect destructured-binding evaluation in the tested Metro/Babel versions. They returned `14` and numeric `81` in the emitted production bundles. The fixture also checks a false flag used in a conditional and an aliased property. See [before.js](before.js) and [after.js](after.js) for the exact changes.

Apply this only to the affected simple bindings you can review. Defaults, rest properties, nested patterns, array destructuring and expressions that must be evaluated once need separate treatment; this is not a general replacement for destructuring. The example does not modify installed dependencies or provide a bundler-wide fix.

## Reproduce the result

Use Node.js 24.3 or newer in the 24.x line. Verification here used Node.js 24.19.0 on macOS.

[Download the example ZIP](https://github.com/tevinch/data-shape-kit/blob/main/downloads/metro-release-values-v0.1.0.zip?raw=true), or clone this repository:

```sh
git clone https://github.com/tevinch/data-shape-kit.git
cd data-shape-kit/examples/metro-release-values
npm ci --ignore-scripts
npm run verify
```

To reproduce the original failure:

```sh
node verify.cjs before
```

That command intentionally exits with status 1 for the production cases. The development cases pass. Running `npm run verify` checks the adjusted source and exits with status 0.

The script calls `Metro.runBuild` for both `ios` and `android`, with development and production settings. Production uses `dev: false` and `minify: true`. It executes each complete emitted JavaScript bundle in Node's VM, checks the actual values and production flag, and writes bundles and results to `.checks/`. Parameter destructuring and a repeated-reference case are included as unchanged controls.

| Metro / transform plugins | Babel core | Babel traverse | Original source, production | Adjusted source, production |
| --- | --- | --- | --- | --- |
| 0.87.0 | 7.29.7 | 7.29.8 | Incorrect values | All checked values correct |
| 0.84.4 | 7.29.7 | 7.29.7 | Incorrect values | All checked values correct |

The included lockfile reproduces the first row. The second row was checked separately with the same fixture and verifier. No dependency upgrade is required to use the source rewrite.

These checks cover Metro's JavaScript output. They do not run React Native, Expo, Hermes or an app on a device. After applying the change, rebuild your own release and check the affected feature with your existing configuration. No upstream fix, release or adoption by the original reporter is implied.

## License

[MIT](LICENSE). The arithmetic and addition examples are adapted from jormaj's linked report; the source workaround and verification code are provided here for reuse.

## Optional coffee

If this saves you some time, you're welcome to buy me a coffee. The example is free, and support is entirely optional.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
