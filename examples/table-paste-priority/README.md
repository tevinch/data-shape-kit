# Table paste priority

A source patch and exact-version runtime patch for **Lime Elements 40.2.2**. Table pastes keep their cell structure and link labels when a cell contains a URL or image. This addresses the handler conflict described in [Lime Elements #4246](https://github.com/Lundalogik/lime-elements/issues/4246).

The editor's existing table behavior still decides placement: compatible rows are inserted after the caret's row, while incompatible widths or mixed blocks use the existing separate-table rule. Explicit cell selections retain grid replacement. Ordinary URL text and standalone image files use their existing handlers, with accepted image files taking priority when URL text accompanies the same non-table paste. The existing Excel/table file exclusions remain in force.

**Image policy:** table HTML image sources are retained without uploading them again. If the host configures `InlineImageTag` without an `upload` callback, newly pasted image nodes are removed while their table, links and other cell content remain. Existing document images are untouched. This preserves that configuration's no-new-image-paste contract. Confirm that retaining pasted HTML image sources is suitable for your host's other image settings before adopting this change.

This is an independent patch, not an upstream release. It is free to use and review. [Download the complete v0.1.0 recipe](../../downloads/table-paste-priority-v0.1.0.zip?raw=true) and extract it to run the commands below.

## Run the reproduction and regression checks

Requires Node.js 20+, npm and Git. From this directory:

```sh
npm ci --ignore-scripts
npx playwright install chromium
npm test
```

The test copies the installed package into a temporary application, reproduces the original failure, applies the patch there, and runs the component through both its ESM loader and lazy browser bundle. Your local `node_modules` stays original. Reports are written under `test-results/`.

To use an already installed Chrome instead of downloading Chromium:

```sh
TABLE_PASTE_BROWSER_CHANNEL=chrome npm test
```

The npm lockfile pins the fixture. Downloading dependencies and a test browser requires network access; fixture inputs, the image upload callback and its image asset are local. Example links are not followed by the tests.

## Apply to an application

Use a regular npm installation of `@limetech/lime-elements@40.2.2`. Keep these recipe files together, then run from this directory:

```sh
node apply-patch.mjs /absolute/path/to/application --check
node apply-patch.mjs /absolute/path/to/application
```

The installer checks the package name, version and SHA-256 of all six affected runtime files before writing. It refuses modified, partially patched or linked installations. pnpm/Yarn linked stores and other versions are unsupported. Applying twice is harmless. Reapply after `npm ci`; restore the unmodified dependency with `npm ci` to remove the patch. Rebuild your application after changing its dependency.

Review [the source diff](patches/source.patch) first. The larger [runtime diff](patches/lime-elements-40.2.2.patch) includes a minified bundle and is provided for exact-version consumers; [hashes.json](hashes.json) identifies the bytes. Do not copy a generated bundle into another version.

## Source integration

The four-file TypeScript patch is based on upstream commit [`0f35e1954c0df289a5b77f2c7f8e59f36da8441a`](https://github.com/Lundalogik/lime-elements/tree/0f35e1954c0df289a5b77f2c7f8e59f36da8441a), the published 40.2.2 source revision. In a matching source checkout:

```sh
git apply --check /absolute/path/to/table-paste-priority/patches/source.patch
git apply /absolute/path/to/table-paste-priority/patches/source.patch
```

The link and image shortcuts decline table-bearing slices. The image plugin's earlier `transformPasted` step enforces the configured no-upload behavior by removing image leaves, preserving their ancestor nodes. The table structure plugin and explicit cell-grid handler then receive the complete remaining slice. A comment at plugin assembly documents this ownership; keyboard plugin order is unchanged.

Run the upstream build and required checks when integrating the source patch. This recipe has not run the full upstream build or its complete test suite.

## Verification scope and limits

The regression script checks 18 scenarios per browser entry:

- Plain tables, URL text paired with HTML links, link display labels, images, and combined link/image cells.
- Paste outside an existing table and replacement of two explicitly selected cells.
- Ordinary URL linkification, completion of a local image-file upload callback, and image-file precedence when the clipboard also contains URL text (including no-upload mode).
- A table-free document: paste the table, move the caret into its first cell, and paste the same clipboard content again, for links, images and both together.
- No-upload image configuration: plain and custom image tags are excluded, table text and links remain, preexisting custom images remain, and standalone image files remain ignored.

Assertions inspect public serialized HTML, table boundaries, cell contents, links and images. Change-event counts are separate from initialized document content: a missing change event is not treated as document deletion. The original image-table failure discards the pasted content; it does not erase the initial four cells in this fixture.

These are software-operated browser checks using constructed clipboard events in Chrome. They are not human manual tests or OS clipboard checks from Excel/Word. The full upstream suite, application-specific integrations, spans/unequal-width cases, and CommonJS component execution have not been verified here. Existing parser normalization remains; for example, an empty image `alt` becomes `file`. Nonempty `alt="sample"`, image sources, link text and href are checked. No reporter acceptance or upstream merge is claimed.

## License

Original fixture and installer code: [MIT](LICENSE). The upstream-derived patches retain Lime Elements' [Apache License 2.0](UPSTREAM-LICENSE) and upstream copyright notices. Preserve both licenses when sharing this recipe.

## Optional coffee

If this free solution saves you some time, you are welcome to buy me a coffee. Please only do so if you want to; the code and help remain free either way.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
