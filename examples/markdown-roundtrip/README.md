# Markdown round-trip

**Upstream status — 22 September 2026:** [PR #8295](https://github.com/ueberdosis/tiptap/pull/8295) for escaped table pipes and [PR #8299](https://github.com/ueberdosis/tiptap/pull/8299) for inline-code backticks have merged into `main`; [issue #8294](https://github.com/ueberdosis/tiptap/issues/8294) is closed. npm `latest` for `@tiptap/markdown` was still **3.31.3** when checked. A merge does not establish a released package fix. Prefer an official release containing the changes when available, remove the temporary patches, and verify repeated export/import with your application's content. The fixture below remains pinned to 3.31.3; its additional space and escaped-code cases have not been rerun against upstream `main` or a newer release.

Version-pinned patches for **Tiptap 3.31.3** that preserve table text containing pipes and single-line inline-code text containing arbitrary backtick runs across repeated Markdown export and import. The fixture checks the shipped ESM and CommonJS files, plus a normal Tiptap `Editor` integration.

[Download source, patches and checks](../../downloads/markdown-roundtrip-v0.1.0.zip?raw=true) · Inspect the [Markdown patch](patches/@tiptap+markdown+3.31.3.patch), [code patch](patches/@tiptap+extension-code+3.31.3.patch) and [table patch](patches/@tiptap+extension-table+3.31.3.patch)

## Try the regression fixture

Use **Node.js 24 or newer** and Git; tested with Node.js 24.19.0. Extract the ZIP, enter its `markdown-roundtrip` directory, then run:

```sh
npm ci --ignore-scripts
npm test
```

The test command verifies the exact original package versions and SHA-256 hashes, copies the installed dependencies to a temporary directory, checks and applies all three patches there, runs identical ESM and CommonJS expectations, and removes the temporary copy. It verifies afterward that the installed dependency files did not change. Dependency installation needs the npm registry; the tests themselves make no network requests.

To run the same expectations against the unmodified packages:

```sh
npm run reproduce
```

That command intentionally exits nonzero. On the tested dependency tree, each module format reports 8 passing controls and 23 content-preservation failures. Missing modules, incomplete execution and absent passing controls are treated as fixture errors rather than successful reproduction.

## Apply the patches to an application

First inspect the versions and copies actually resolved by your editor:

```sh
npm ls @tiptap/core @tiptap/markdown @tiptap/starter-kit @tiptap/extension-code @tiptap/extension-table marked
```

These patches target the unmodified files at:

- `node_modules/@tiptap/markdown` version 3.31.3
- `node_modules/@tiptap/extension-code` version 3.31.3
- `node_modules/@tiptap/extension-table` version 3.31.3

Copy the three files from this example's `patches` directory into your application's `patches` directory. From the application Git repository root, with those exact packages installed, inspect the patches and run:

```sh
git apply --check patches/@tiptap+markdown+3.31.3.patch
git apply --check patches/@tiptap+extension-code+3.31.3.patch
git apply --check patches/@tiptap+extension-table+3.31.3.patch

git apply patches/@tiptap+markdown+3.31.3.patch
git apply patches/@tiptap+extension-code+3.31.3.patch
git apply patches/@tiptap+extension-table+3.31.3.patch
```

If a check fails, inspect the resolved version, package location and existing modifications before continuing. A nested or different package copy is not patched by adding a direct dependency. Rebuild and test the application after applying the patches.

Reinstalling dependencies overwrites manual edits. Applications that use npm can choose [patch-package's documented setup](https://github.com/ds300/patch-package#usage) and commit these patch files. Configure any persistence lifecycle explicitly in the application; this fixture adds no installation hook.

## What changes

The unmodified inline-code renderer always uses a single backtick fence. Content such as ``hello ` world`` therefore emits Markdown that closes early. The patched renderer sees the full continuous code-mark run, chooses the shortest backtick fence length absent from that text, and adds CommonMark padding when an edge backtick or two edge spaces require it.

For example, this code-marked text:

```text
hello ` world
```

is emitted as:

```markdown
``hello ` world``
```

The table renderer escapes cell pipes while retaining existing backslash pairs. It also distinguishes escaped literal backticks from actual code fences, preserving spaces inside code spans while it collapses layout whitespace outside them. A GFM pipe table cannot directly represent an odd literal backslash run immediately before a pipe inside backtick code: Marked uses the same backslash both to protect the column delimiter and then removes it. For that narrow combination, the serializer emits an escaped, attribute-free `<code>…</code>` span with the pipe represented as `&#124;`. The Markdown manager recognizes that form only when its decoded content contains an odd backslash run before the encoded pipe, then sends it through the registered `codespan` handler in browser and server environments. Ordinary `<code>` HTML and code HTML containing an encoded pipe without the odd backslash keep the existing parser or literal-text behavior.

Other Markdown consumers must support and preserve inline HTML for this fallback to round-trip. A renderer, sanitizer or storage layer that strips, escapes or disables inline HTML can remove the code mark or change the literal content.

The patch updates the published TypeScript source and both runtime formats in all three packages. It removes stale source-map comments from edited runtime files because the package's original maps no longer describe the patched code.

## Verification and limits

The suite serializes and reparses every document three times, always using the reparsed result on the next pass. It compares content, relevant marks and table structure. Its 62 passing patched scenarios cover arbitrary backtick runs; sole, leading and trailing backticks; both-edge, repeated and whitespace-only spaces; adjacent plain text; split text nodes in one continuous code mark; pipe positions and repetition; 0 through 6 preceding backslashes in plain and code-marked cells; escaped literal backticks immediately before code with repeated, edge or whitespace-only spaces and odd-backslash pipes; bold, italic and link marks; Unicode; multiple rows and cells; code containing both backticks and pipes; ordinary and encoded-pipe-only code HTML compatibility controls; DOM-free parsing; and a jsdom-backed `Editor` path.

This fixture covers single-line inline code and the listed table shapes on the exact dependency versions above. CommonMark's normalization of line endings inside code spans, custom Markdown extensions, custom HTML behavior, custom table schemas and unrelated mark-overlap or inline-atom behavior need separate tests. It does not claim universal lossless Markdown conversion. The complete local patch set has not been accepted upstream; the two source PRs named above have merged.

The core algorithms adapt [Tiptap PR 8295 by lazerg](https://github.com/ueberdosis/tiptap/pull/8295) and [Tiptap PR 8299 by vingt-douze](https://github.com/ueberdosis/tiptap/pull/8299). The exact-space handling and narrow escaped-code fallback are local adaptations needed by the regression contract. The source portions retain Tiptap's MIT notice in [LICENSE](LICENSE).

## Buy me a coffee, if this helped

If this saved you some time, you're welcome to buy me a coffee. Please don't feel obliged — the code stays free, and useful feedback is welcome too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please match the asset and network exactly. Fees depend on your wallet or exchange. Thank you! — Tevinch
