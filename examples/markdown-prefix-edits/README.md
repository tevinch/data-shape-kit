# Preserve unchanged prefixes when parsing Markdown

micromark 4.0.3 can repeatedly copy an entire event prefix while parsing separated block quotes, nested lists and Setext headings. In [issue #246](https://github.com/micromark/micromark/issues/246), ChristianMurphy identified the repeated copy and proposed keeping that prefix in place. [Source PR #249](https://github.com/micromark/micromark/pull/249) applies that change and adds the three reported inputs to the existing performance script.

The correction is under review and has not shipped in an official release. This example provides a small **unofficial** build of `micromark-util-edit-map`, its source reference and a complete parser check. It keeps the upstream package name and version, `1.0.0`.

## Try the complete example

From this directory, with Node.js 24:

```sh
npm ci --ignore-scripts
npm run verify
```

The lockfile installs official `micromark@4.0.3` with the included corrected edit-map archive. The check parses nine complete documents, compares each buffered result with the public stream fed in 257-character chunks, checks token positions and verifies all 652 CommonMark examples. It writes `verification.json`, including hashes and proof that the stream received data and reached its end. These are scripted checks; there is no human manual validation or original-reporter adoption claim.

The archive SHA-256 is:

```text
1cdb4513cf224f89230b1a95ccdd4eb2aeab6d58b372275c666445468af3bc1b
```

To test the correction in your own application, copy the archive into your project and install it as a direct dependency. Keep the file and its lockfile entry together:

```sh
npm install --ignore-scripts ./micromark-util-edit-map-1.0.0-prefix.tgz
npm ls micromark-util-edit-map
```

Confirm that the micromark instance you use resolves to this copy; a second nested copy can leave the old behavior active. Keep your existing parser options, extensions and documents, then repeat your full conversion and stream workflows. Return to the official package when an upstream release includes the correction.

## Source and local measurements

The archive was built from [commit 9e3e6ea](https://github.com/tevinch/micromark/commit/9e3e6eaf77d1aeeada61255ec21a44471810e37b). Its development source differs from the official edit-map 1.0.0 package only by the prefix-preserving correction and comment. Review the change and rebuild it with:

```sh
git clone --single-branch --branch fix-edit-map-prefix https://github.com/tevinch/micromark.git
cd micromark
git checkout 9e3e6eaf77d1aeeada61255ec21a44471810e37b
npm install --ignore-scripts
npm run build
npm pack --workspace=micromark-util-edit-map --ignore-scripts
```

The upstream repository does not commit a dependency lockfile; the example above has its own pinned consumer lockfile. The source build used Node.js 24.19.0. Its `npm test` passes build, type, format and 100% coverage checks with 1,944 tests; the production API run also passes all 1,944 tests. The included archive was installed in a separate consumer and passed the same nine-document and 652-example comparisons against the source build.

On Apple M1/macOS, three fresh-process production runs per version, in AB/BA/AB order, produced these medians:

| Input | Bytes | Unchanged main | Correction |
| --- | ---: | ---: | ---: |
| Separated block quotes | 32,770 | 7,311.8 ms | 858.8 ms |
| Nested list items | 32,770 | 3,541.0 ms | 775.6 ms |
| Setext headings | 32,768 | 19,584.3 ms | 793.4 ms |

The corresponding 8 KiB → 32 KiB time ratios were 14.1/7.8/19.8 before and 3.5/3.8/3.4 afterward. Each measured operation returned the entire HTML output. Buffered HTML and token positions matched across nine documents and 652 CommonMark examples. The nine documents also produced identical output through the chunked stream.

All [raw timings](benchmark/comparison.json) are retained. The mixed-workload run showed small-document and README medians about 22% and 18% slower after the correction. Additional [paired comparisons](benchmark/small-summary.json), with equal warmup and both module load orders, had median after/before ratios of 0.982 and 0.979. Individual samples varied substantially, including identical-source controls. These measurements support the large repeated-prefix improvement; they do not establish a small-document speedup or performance on other machines.

`verify.mjs` also accepts a built source checkout as its first argument, an output JSON path as its second, and `bench` as its third for timing-only runs. Use the same reference Markdown file as the optional fourth argument to compare installations. Each timing run uses a 1 KiB warmup and one full parse per large input; the small case measures a 1,000-parse batch. The upstream `node test/perf.js` includes the three reported patterns as additional timing probes, without a fragile absolute CI threshold.

The separate [PR #244](https://github.com/micromark/micromark/pull/244) reduces peak memory in one edit-map operation. This proposal addresses repeated prefix copying; the two changes need reconciling if both are adopted. No claim is made about other parser performance issues.

micromark and the reference fixture are MIT licensed. See [the retained license](LICENSE.micromark). The original diagnosis and correction proposal are ChristianMurphy’s; this example supplies the source contribution, build and independent verification.

## Optional coffee

The correction and example are free. If they save you time and you would like to buy me a coffee, thank you. It is entirely optional.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
