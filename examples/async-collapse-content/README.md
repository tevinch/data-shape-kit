# Async collapse content

If a Naive UI table stays empty after its data arrives inside `NCollapseTransition`, create the table inside the slot function and read its reactive data there. This example accompanies [McPorkChop's reproduction in Naive UI #8207](https://github.com/tusen-ai/naive-ui/issues/8207).

This is an application workaround for a render-function call site you control. It does not patch Naive UI or repair a third-party component that supplies a prebuilt node.

## Change the call site

The reported pattern creates the node before the slot runs:

```js
render() {
  const table = h(NDataTable, { columns: this.columns, data: this.list });
  return h(NCollapseTransition, { show: this.show }, {
    default: () => table,
  });
}
```

Move both node creation and the reactive read into the callback:

```js
render() {
  return h(NCollapseTransition, { show: this.show }, {
    default: () => h(NDataTable, {
      columns: this.columns,
      data: this.list,
    }),
  });
}
```

With a ref in `setup()`, read `list.value` inside that callback. Capturing `const data = this.list` outside it and passing `data` inside still captures the old array. Vue's [slot guidance](https://vuejs.org/guide/extras/render-function.html#passing-slots) explains how lazy slot execution lets the consuming component track its dependencies.

The demo uses the real `NCollapseTransition` and `NDataTable`. It also keeps an editable child note beside the table so you can check that data changes preserve local state. There is no changing `key` to force a remount. The normal display behavior remains: `show` retains mounted content while collapsed; `if` removes it and resets child-local state when reopened.

## Run the example

Download the [source and checks ZIP](https://github.com/tevinch/data-shape-kit/raw/refs/heads/main/downloads/async-collapse-content-v0.1.0.zip), or use this directory from the repository. Use Node.js 22.12+ on the 22.x line, or Node.js 24+.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run dev
```

Open the local URL printed by Vite. Type in the note, load eight rows, replace them, collapse, reload and expand. Use `?directive=show` for retained content and `?hidden=1` to start collapsed. Add `mode=before` to either query to compare the original pattern.

## Run the browser checks

The verification uses a fresh headless browser against a minified Vite production build. Install a test browser once, then run:

```sh
npx puppeteer browsers install chrome
npm run verify
```

Alternatively, set `PUPPETEER_EXECUTABLE_PATH` to an existing compatible Chrome executable before running the command. It does not use your normal browser profile. Dependency installation needs network access; the example itself uses a local simulated response and uploads nothing.

```sh
npm run verify -- before
```

The comparison command intentionally returns a failing exit status when the original pattern leaves displayed rows stale. Results and screenshots are written to `.checks/`; generated production files go to `dist/`.

Verified on 2026-09-13 with Chrome/152.0.7977.83 on macOS: all four production-browser cases passed. The original pattern failed in all four cases: initially visible tables stayed empty, while initially hidden tables retained the first response after replacement.

The fixture pins Naive UI 2.45.3, Vue 3.5.42, Vite 8.2.2 and Puppeteer 25.9.0. Checks cover both display directives, initially visible and hidden content, eight-row loading, replacement, a hidden update followed by reopening, clearing and reloading, and child state. They exercise array replacement, matching the reported asynchronous response. Other browsers, server rendering and third-party wrapper components need their own checks.

## License

[MIT](LICENSE) for this example. Naive UI and Vue retain their own licenses. Thanks to McPorkChop for the original reproduction.

## Optional coffee

This example is free to use and adapt. If it saves you some time and you'd like to buy me a coffee, thank you. There is no obligation; a useful bug report helps too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
