# Keep original images in Astro's incremental builds

If a cached page uses `<img src={photo.src}>` and another page optimizes the same image with `<Image>`, a repeat build can delete the original PNG while the cached HTML still points to it. This recipe preserves that original image through repeated cache restores.

It adds per-page image reference tracking to the [Astro preview linked in #17974](https://github.com/withastro/astro/issues/17974#issuecomment-5631533670). That preview already handles the Sass partial change in the original report. The added patch handles the [remaining image problem reported by elevatebart](https://github.com/withastro/astro/issues/17974#issuecomment-5632948538).

## Try the example

Use Node.js 22.12 or newer, npm and Git. The verified environment is Node.js 24.19.0 on macOS, with the included lockfile.

[Download the example ZIP](../../downloads/astro-cached-images-v0.1.0.zip), or clone the repository:

```sh
git clone https://github.com/tevinch/data-shape-kit.git
cd data-shape-kit/examples/astro-cached-images
npm ci --ignore-scripts
node apply-patch.mjs --check
node apply-patch.mjs
npm run verify
```

The verification runs real production builds. It checks three cached pages sharing a PNG, a separate page producing a 32-pixel WebP, changed Sass and image content, removal of individual pages, and migration from a cache without image reference metadata. Every referenced asset must exist and decode with the expected dimensions. Unchanged pages must still be restored from cache, and an original used only for image optimization must still be removed. Logs stay under `.checks/`.

To reproduce the failure first, run `node verify-workflow.mjs` after `npm ci` and before applying the patch. The second build fails because a cached page's PNG is missing. After applying the patch, `npm run verify` should pass.

## Use it in an application

Review [the runtime diff](patches/astro-7.3.2.patch) and [source diff](patches/source.patch). In your application's directory:

```sh
npm install https://pkg.pr.new/astro@cb815d8
node /absolute/path/to/astro-cached-images/apply-patch.mjs . --check
node /absolute/path/to/astro-cached-images/apply-patch.mjs .
```

Keep your existing Astro configuration and pages. Run your build twice and check the generated site. The first patched build regenerates older cached pages once; subsequent unchanged builds can reuse them. Apply the patch again after reinstalling dependencies. A repeated application is a no-op.

The installer checks the package name, version and every affected file's SHA-256 before applying anything, then verifies the resulting bytes. It refuses unknown edits, partial patches, symbolic links and hard links. Use a regular npm `node_modules/astro` installation. pnpm stores, Yarn Plug'n'Play and linked workspaces are unsupported. The package reports version 7.3.2, so the byte checks also matter: verification here targets the exact `cb815d8` preview.

To undo, run `npm ci` with your saved lockfile. Review this temporary patch when an upstream release addresses the image issue.

## How it works

Each rendered page records the source paths it reads outside image processing, including reads already seen on another page. Those references travel with the page's cached output. Restoring the page replays them before image cleanup. The collector uses Astro's existing render scope, keeping concurrent pages separate. A cache entry without reference metadata is rebuilt instead of reused.

The [source diff](patches/source.patch) targets the upstream [`cb815d8` source](https://github.com/withastro/astro/tree/cb815d8). In a matching checkout, use `git apply --check` before applying it. No upstream merge or release is implied. The separate CSS work in [#17976](https://github.com/withastro/astro/pull/17976) belongs to its authors.

Verification covers scripted static production builds with the default image service, external stylesheets and build concurrency 4. SSR adapters, custom image services, custom prerenderers, other package versions and the full upstream test suite have not been verified. A custom prerenderer that omits the added metadata will rebuild its pages. The broader CSS chunk regrouping and function-valued preprocessor cases from the original discussion are outside these tests.

## License

The fixture and installer use the [MIT license](LICENSE). Upstream-derived patches retain Astro's [license notices](UPSTREAM-LICENSE). Keep both when sharing.

## Optional coffee

If this saves you some time, you're welcome to buy me a coffee. The code is free, and any support is entirely optional.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
