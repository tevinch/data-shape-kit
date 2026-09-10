# TanStack Form validation state patch

A small, inspectable workaround for **`@tanstack/form-core` 1.33.5** when an older asynchronous field check finishes while a newer check is still pending. It includes executable regression checks against the real Form API, for both ESM and CommonJS.

The need comes from [TanStack Form #2045](https://github.com/TanStack/form/issues/2045). The issue author already has [an upstream PR, #2047](https://github.com/TanStack/form/pull/2047). This separate patch targets the published 1.33.5 package; it is not that PR and does not imply upstream acceptance. Check the upstream issue and release notes before adopting it on a newer version.

## Run the example

Download the [source ZIP](../../downloads/tanstack-validation-state-v0.1.0.zip?raw=true), extract it, then run:

```sh
cd tanstack-validation-state
npm ci --ignore-scripts
npm test
```

Use Node.js 22 or newer and Git. The fixture pins its official dependency and records the dependency tree in `package-lock.json`. All validation values and responses are synthetic; no real account or remote validation service is used.

To see the regression in the original package:

```sh
npm run reproduce
```

This command deliberately exits with a failure when the original package violates the expected behavior. `npm test` applies the patch to a temporary copy and runs the same behavioral checks against the patched package. A failing original reproduction is expected; a failing patched run needs investigation.

The verifier checks the exact package version and original source hashes before copying or applying anything. It creates a unique `.verification-*` directory beside this example and removes its own directory afterward, including on failure. It does not patch your original `node_modules`. Verification makes no network requests; installing dependencies requires access to the npm registry.

## What the patch changes

The field-validation code keeps a handle for its debounce timer. In the affected version, a handle remains stored after the timer has fired and started its checker. Starting another check can therefore count that earlier, already-running check as cancelled; when the earlier promise actually settles, the pending count is reduced again.

The patch clears the stored handle when the timer callback starts. Cancelling a timer that is still waiting retains the existing behavior, and a running check retains its existing settlement path. The patch also publishes the form's aggregate `isValidating` value from field or form validation activity, and uses that value for the existing `canSubmit` calculation.

Matching shipped TypeScript source, ESM runtime and CommonJS runtime files are patched. Changed runtime files no longer refer to their original source maps, because the edits invalidate those mappings. Public signatures and the existing pending-counter mechanism are retained.

## Apply to an application

First run the independent example above. Its success verifies this fixture's installed package; it does **not** prove your application's lockfile resolves the same package or that your framework adapter loads that copy.

Pin the affected dependency in your application and inspect the resolved tree:

```sh
npm install --save-exact @tanstack/form-core@1.33.5
npm ls @tanstack/form-core
```

If you use a framework adapter, confirm it resolves the same 1.33.5 copy you intend to patch. A nested copy or another version needs its own compatibility assessment. This example does not override your adapter's dependency requirements.

Before applying the patch, compare the SHA-256 hashes of the six files listed in `EXPECTED_HASHES` near the top of `verify.mjs` with your installed files under `node_modules/@tanstack/form-core`. Stop if the version or any hash differs. An already modified installation is outside this fixture's supported scope.

Copy `patches/@tanstack+form-core+1.33.5.patch` into your application's `patches` directory. From the application root containing `node_modules`, inspect the patch and check that it applies before making the change:

```sh
git apply --check patches/@tanstack+form-core+1.33.5.patch
git apply patches/@tanstack+form-core+1.33.5.patch
```

`git apply --check` checks patch context, not every byte of every file; it does not replace the version and hash comparison above.

Run your application's validation and submission checks afterward. Reinstalling dependencies can overwrite a manual patch. If your application already uses [patch-package](https://github.com/ds300/patch-package#applying-patches), the patch uses its conventional `node_modules` paths and filename; arrange reapplication through your application's own install workflow. This repository does not add a postinstall hook or alter your application's configuration.

## Verification scope

The example uses mounted `FormApi` and `FieldApi` instances and controllable promises. It exercises old-first and latest-first completion with and without debounce, an old checker that ignores cancellation, independent fields, linked-field validation, a form-level asynchronous validator, idle behavior and changes that supersede a timer before it starts. Assertions use public state and subscriptions. All 18 scenarios pass on the patched copy with Node.js 24.19.0, including a fresh install from the source ZIP.

The pending indicator must remain true while the newer check is in flight, and the latest result must own the displayed field error after settlement. Form-level activity contributes to the aggregate indicator. The fixture checks Node ESM and CommonJS execution; it does not establish native browser rendering or every framework adapter's behavior, nor fix every possible form-level validation lifecycle problem.

## License

[MIT](LICENSE), including the original TanStack Form copyright notice. You may use, modify and share the patch and fixture while retaining the notices.

## Buy me a coffee, if this helped

If this saved you a little time, you're welcome to buy me a coffee. Please don't feel obliged — the code stays free, and feedback with a small reproducible example is appreciated too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please match the asset and network exactly. Fees depend on your wallet or exchange. Thank you! — Tevinch
