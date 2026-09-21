# Recover effect scheduling after an inner flush

In Svelte 5.57.1, a self-invalidating effect that calls `flushSync()` can leave the scheduler without a current batch. The next scheduling step throws `Cannot read properties of null (reading 'schedule')`, and the effect's settling run is lost.

This checks and packages the `Batch.ensure().schedule(effect)` change proposed by **ndri** in [Svelte #18850](https://github.com/sveltejs/svelte/issues/18850). The reproduction mounts a child on a button click, changes its state inside an effect and flushes immediately. It then checks further updates, resets and three separate mounts. The unpatched example still responds to later clicks; the demonstrated defect is the error and missing effect rerun.

Download the [patch and checks](../../downloads/svelte-effect-recovery-v0.1.0.zip?raw=true). This is a proposed fix, not an upstream release.

## Check the reproduction

Use Node.js 22 or newer. From this example's directory:

```sh
npm ci --ignore-scripts
npx playwright install chromium
npm test
```

Or use an installed Google Chrome with `CHROME_CHANNEL=chrome npm test` on macOS/Linux. The test makes separate original and patched copies of Svelte in `.verification/`, bundles each and checks them in a headless browser. It leaves the installed Svelte source unchanged. Running it again replaces `.verification/`.

The original copy must fail with the reported error. The patched copy must pass in development and production with `experimental.async` both off and on. Each case verifies the active compiler mode, six `flushSync()` calls, the full effect-value sequence and the DOM after every operation. A missing browser or omitted operation does not count as reproducing the bug.

## Use the version-checked patch

For an application already using **exactly `svelte@5.57.1`**, copy `patch.mjs` into your project and run it against the installed Svelte package:

```sh
node /path/to/patch.mjs /path/to/project/node_modules/svelte
```

The helper checks both the version and the complete source-file SHA-256 before changing one line in `src/internal/client/reactivity/batch.js`. It refuses a different version or locally modified file and leaves them unchanged. Running it on the same patched file is harmless.

Restart the development server and rebuild your application's assets so they use the changed source. Reinstalling dependencies removes this patch. If you need it across installs, include the helper in your own install workflow or use your package manager's patch support. Keep the version pinned and remove the workaround when an upstream release fixes the issue; do not force it onto a newer version.

Check your application's actual failing interaction before deploying. The included example does not cover every scheduling, boundary or pending-update combination.

## Source patch for review

[`svelte-source.patch`](svelte-source.patch) includes the one-line runtime change and an upstream-style regression sample. It applies to the Svelte source tree at [`636eaaaa`](https://github.com/sveltejs/svelte/commit/636eaaaa6f064b55072e7d192bb76dc9d8c4516e).

```sh
cd /path/to/svelte
git apply --check /path/to/svelte-source.patch
git apply /path/to/svelte-source.patch
pnpm test runtime-runes -t effect-self-schedule-after-flush
```

Install the source tree's dependencies first using its [contributing guide](https://github.com/sveltejs/svelte/blob/main/CONTRIBUTING.md). The added sample fails before the runtime change and passes afterward in both DOM and hydration modes. It checks that the effect observes `[0, 1, 2, 0, 1]` on each mount/update/reset cycle, rather than merely suppressing an exception.

## Scope and verification

The versioned browser checks ran against Svelte 5.57.1 in Google Chrome on macOS arm64. These are scripted browser checks, not manual validation of an affected production application.

On upstream `636eaaaa`, `pnpm lint` passed. The full `pnpm test` run reported 7,685 passes, five timeouts and a browser suite blocked by a missing Playwright browser. After installing that prerequisite, `pnpm test runtime-browser` passed all 133 tests. The affected timeout group then passed all 10 selected tests with one worker on both the original and patched source, retaining the default timeout. This records the follow-up results separately; it is not a claim that the initial full run passed.

Svelte's [runtime-error documentation](https://svelte.dev/docs/svelte/runtime-errors#flush_sync_in_effect) cautions against calling `flushSync()` inside an effect with asynchronous compilation. The tested 5.57.1 runtime and current source do execute this path; current upstream tests also exercise an inner flush. This patch only restores the missing batch in that path. It does not change validation rules or establish support for this pattern across versions. Where your application can move the flush to an event handler without changing its behavior, prefer that arrangement.

## License

The Svelte source patch retains the upstream [MIT license](LICENSE). The accompanying patch helper and checks are Copyright 2026 Tevinch and available under the same license.

## Optional coffee

If this saves you some time and you'd like to buy me a coffee, thank you. It's entirely optional; the patch and checks are free.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
