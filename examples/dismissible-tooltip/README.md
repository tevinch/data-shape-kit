# Dismissible chart tooltip

A small React hook and runnable Recharts Scatter example for closing a hovered tooltip, showing a details dialog, and restoring normal hover when the pointer reaches a different data point. Free under the MIT license.

[Download source and tests](../../downloads/dismissible-tooltip-v0.1.0.zip?raw=true)

## The integration problem

[Recharts #6281](https://github.com/recharts/recharts/issues/6281) describes a tooltip that remains visible after a point opens a modal. Permanently setting `active={false}` hides it, but the application then needs a way to restore hover. [Issue #1231](https://github.com/recharts/recharts/issues/1231) contains related requests for a closable tooltip. Maintainers recommend the public `active` prop; this example supplies the application state around that prop.

The [Tooltip API](https://recharts.github.io/en-US/api/Tooltip/) distinguishes `false`, which hides the tooltip, from `undefined`, which lets Recharts manage ordinary interaction. This hook returns only those two values. It does not force the tooltip to stay visible.

## Run the example

Extract the ZIP, open a terminal in `dismissible-tooltip`, and use Node.js 22.22.2 or newer within Node 22, Node.js 24.15.0 or newer within Node 24, or Node.js 26.0.0 or newer:

```sh
npm ci --ignore-scripts
npm test
npm run typecheck
npm run build
npm start
```

Open the loopback URL printed by the preview server. The build needs the documented packages installed; it is not a file that runs directly by double-clicking HTML. React, React DOM and React Is are pinned to 19.3.0, Recharts to 3.10.1, Vite to 8.2.2 and TypeScript to 5.9.3.

Try the following with the invented points:

1. Hover point A to show its values, then click it to open details. The tooltip closes immediately.
2. Close the dialog. The old point's tooltip stays closed, including when that point receives another enter event.
3. Move to point B. Normal hover resumes. Move away from B and Recharts hides the tooltip as usual.
4. Open details from a button in the data table, then close using the dialog button or Escape. The table provides the values and details controls without requiring a pointer tooltip.

No data is uploaded or stored. The sample has one scatter series, an HTML table of the same points and a native dialog.

## Copy the hook

Copy [useDismissibleTooltip.ts](useDismissibleTooltip.ts) and [LICENSE](LICENSE) into a React TypeScript project. React is the hook's only import; Recharts is needed by the example. The hook is a named export and takes an optional `{ suspended?: boolean }` argument.

| Returned member | Contract |
| --- | --- |
| `active` | `false` while suspended or dismissed; otherwise `undefined` |
| `dismissedId` | The dismissed stable string ID, or `null` |
| `dismiss(id)` | Close the tooltip for this point |
| `enter(id)` | Keep the same point closed; a different point clears dismissal |
| `reset()` | Clear dismissal; suspension still hides the tooltip |

Both ID methods require a nonempty string and throw `TypeError` for invalid runtime inputs. IDs are compared exactly without trimming or numeric coercion. Use record identity, not a displayed array position.

The complete wiring is in [App.tsx](App.tsx): pass the modal-open state as `suspended`, feed the returned `active` value to `Tooltip`, call `enter` from the public Scatter enter callback, and call `dismiss` before showing details. While the dialog is open, enter events cannot clear the remembered dismissal. Closing the dialog alone does not clear it.

Each hook instance owns its own state. Reset it when replacing a dataset whose point IDs have a different meaning. The intentionally chosen behavior requires visiting a **different** point before the dismissed point can show again. Leaving and re-entering only the dismissed point keeps it closed.

## Scope

This is application logic around public props and callbacks, not a change to Recharts. It does not call private event emitters, mutate a chart ref's state, or remount the chart to reset it. Native chart hover controls remain in charge after the gate reopens.

The demonstrated tooltip behavior is mouse hover on a single Scatter series. The HTML table supplies a keyboard-accessible route to the same data and dialog; this is not a general keyboard or touch tooltip adapter. The chart sets `accessibilityLayer={false}` for this pointer-focused demonstration because the always-visible HTML table supplies equivalent data and keyboard details controls; retain the table when adapting that choice. Check your own chart type, input method, series identifiers and modal implementation before adapting it. No v2 compatibility or map synchronization is claimed.

## Verification

Verified by execution with Node.js 24.19.0, React 19.3.0 and Recharts 3.10.1: seven tests passed, followed by TypeScript checking and a production build. The tests mount the actual React hook and Recharts chart. They cover repeated enters at the dismissed point, visiting another point, restored native hiding, suspension during the dialog, reset, separate instances, invalid IDs and table-driven details. The supported Node range is 22.22.2 or newer within Node 22, 24.15.0 or newer within Node 24, or 26.0.0 or newer. The Node 22 and Node 26 branches are inferred from the locked packages' engine metadata; only Node.js 24.19.0 was executed here.

The test DOM supplies only the missing native dialog methods. Chrome separately verified the A → details → close → A stays hidden → B shows → leave hides flow, table activation with Enter, closing with Escape, and focus returning to the table button. At a 390px viewport, the page had no horizontal overflow; chart and table scroll within their own containers. Browser warning and error logs were empty.

The build succeeds with Vite's advisory about the example's 571.71 kB minified JavaScript bundle (171.16 kB gzip). That includes React and Recharts; the copyable hook imports only React.

## License

Original code is [MIT licensed](LICENSE). Keep the license when copying the hook. Retain the included third-party notices when sharing a built example.

## Buy me a coffee, if this helped

This example is free. If it saves you a little time and you feel like buying me a coffee, a small contribution is welcome. There is no obligation; useful feedback is appreciated too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please use the asset and network shown above.
