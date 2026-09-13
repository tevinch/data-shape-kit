# Storybook Jest configuration

An exact-version compatibility patch for **Storybook 10.6.0**, **@storybook/test-runner 0.24.5** and **Jest 30.5.1**. Keep your test-runner configuration and its hooks when a run fails during setup with:

```text
module.register() is not supported in Jest: ...
```

The problem is reported in [Storybook #36116](https://github.com/storybookjs/storybook/issues/36116) and [#36269](https://github.com/storybookjs/storybook/issues/36269). This independent recipe includes a small source diff, a checked runtime installer and a runnable React Webpack fixture. It is free to use and review. [Download v0.1.0](../../downloads/storybook-jest-config-v0.1.0.zip?raw=true).

## Run the comparison

Use Node.js 22.13+ (verified here on 24.19.0), npm and Git. Extract the download and run from this directory:

```sh
npm ci --ignore-scripts
npx playwright install chromium
node verify-workflow.mjs --baseline
node apply-patch.mjs . --check
node apply-patch.mjs .
npm test
npm run verify:workflow
```

The baseline command succeeds only when the original installation reproduces the expected setup failure. After applying the patch, the workflow command builds the real Storybook, serves it on an ephemeral loopback port, and runs two story interaction tests with TypeScript configuration, a second TypeScript run and JavaScript configuration. Each story requires the pre-visit marker and checks its counter after one or two clicks. The workflow also requires a completion record from the post-visit hook for each story. Logs and JSON reports go to `test-results/`.

For an already installed Chrome, omit the browser download and prefix the two workflow commands with `PLAYWRIGHT_CHANNEL=chrome`. Dependency and browser installation require network access; the fixture server binds to `127.0.0.1` and closes after testing.

## Apply to an application

Keep `apply-patch.mjs`, `hashes.json` and `patches/` together. For an application with a regular npm installation of `storybook@10.6.0`:

```sh
node apply-patch.mjs /absolute/path/to/application --check
node apply-patch.mjs /absolute/path/to/application
```

The installer verifies the package name, exact version and original SHA-256 before changing one runtime file. It refuses unknown edits, symbolic links and hard-linked files, verifies the resulting bytes, and treats a second application as a no-op. Other Storybook versions, pnpm stores, Yarn Plug'n'Play and linked workspaces are unsupported. A regular Yarn `node-modules` layout may satisfy the checks, but Yarn installation has not been verified here.

Keep your existing `.storybook/test-runner` configuration, story tests and Jest options. The fixture's configuration is only an example; do not replace your application's hooks with it. Apply after each dependency reinstall, then run your full test command. To undo a change in an npm application, restore the dependency with `npm ci`. Review and remove the patch when an upstream release resolves the issue.

## What changes

Storybook registers its TypeScript loader before importing configuration. Jest 30.5 refuses that Node API inside its own environment. The patch allows configuration import to continue only for that specific refusal; Jest's existing module transformation then handles the fixture's configuration. Other registration errors still propagate. Loader registration outside Jest continues to run, and errors thrown by a configuration module remain visible.

Review [the source diff](patches/source.patch) and [runtime diff](patches/storybook-10.6.0.patch). [The manifest](hashes.json) identifies the exact bytes and the published 10.6.0 source revision, [`a777773`](https://github.com/storybookjs/storybook/tree/a77777356be2aeaff89d7a2b25254db7b2318392). In a matching source checkout:

```sh
git apply --check /absolute/path/to/storybook-jest-config/patches/source.patch
git apply /absolute/path/to/storybook-jest-config/patches/source.patch
```

This is not an upstream release or merge. The earlier investigation and proposed catch in [theRizwan's PR #36140](https://github.com/storybookjs/storybook/pull/36140) informed this recipe; that PR was closed without merging. This patch limits the catch to Jest's specific refusal. An existing alternative is restoring a working lockfile with the Jest 30.4 dependency family; pinning only the top-level Jest package can still allow newer transitive packages.

## Verification scope

The comparison uses software-operated Chrome interaction tests on Node.js 24.19.0 and the pinned React Webpack versions above. It also checks ordinary Node loading of a TypeScript enum configuration, propagation of a broken configuration, unrelated registration failures and installer boundaries.

These are scripted checks, not human manual validation or confirmation from the original reporters. Other frameworks, operating systems, Node versions, project-specific transforms and the full upstream monorepo build/test suite have not been verified. The recognized `module.register()` error prefix is part of this patch's compatibility boundary; unrecognized registration errors still throw.

## License

Original fixture and installer: [MIT](LICENSE). Upstream-derived patches retain Storybook's [MIT license](UPSTREAM-LICENSE). Preserve both notices when sharing.

## Optional coffee

If this free solution saves you some time, you are welcome to buy me a coffee. Please only do so if you want to; the code and help remain free either way.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
