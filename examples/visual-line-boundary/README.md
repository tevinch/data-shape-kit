# Keep inline content on the neighbouring visual line

In Lexical 0.51.0, deleting to a visual line boundary can also remove an inline decorator on the next or previous line. [Lexical #9234](https://github.com/facebook/lexical/issues/9234) shows this with an equation in both plain and rich text. This small command extension keeps that neighbouring-line node while deleting the requested text.

For the forward example, `alpha beta gamma delta ` ends on line one and the equation starts line two. With the caret after `al`, deleting to the end of the line should leave `al`, the equation and the following text. The unmodified editor also deletes the equation. The backward example has the equation on line one and `epsilon` on line two: deleting from after `eps` should leave the equation and `ilon`.

## Use in an existing editor

Copy [visual-line-boundary.js](visual-line-boundary.js) into your application and import it beside your editor setup:

```js
import {registerVisualLineBoundary} from './visual-line-boundary.js';

// Register after the application's usual plain/rich text setup.
const unregisterBoundary = registerVisualLineBoundary(editor);

// In your existing unmount/cleanup callback, call:
// unregisterBoundary();
```

The module imports the application's own `lexical`; do not bundle a second Lexical instance. Keep the usual text and history registrations. No upstream files, node serializers or document data need modification.

The extension uses the documented [command registration API](https://lexical.dev/docs/concepts/commands) with `COMMAND_PRIORITY_BEFORE_EDITOR`. It measures the browser's collapsed caret movement to a visual line boundary. Only when that boundary is beside a non-isolated inline decorator on another visual line does it delete the measured text range directly. Other commands continue to the existing editor handlers.

## Run the example and checks

Download and unpack [the source example](visual-line-boundary-source.zip), or use this directory from the repository. With Node.js 20 or newer:

```sh
npm ci --ignore-scripts
npm run build
npm start
```

Open `http://127.0.0.1:8771`. The server listens only on the local interface. The pinned example uses Lexical 0.51.0 and esbuild 0.28.2.

- **Reset forward** places the caret after `al`; **Delete line** performs the forward operation.
- **Reset backward** places it after `eps` in the following text; **Delete line** performs the backward operation.
- Change **Rich text**, compare with **Enable boundary extension** off, and use **Undo** and **Redo**. Resetting starts a fresh fixture.
- On macOS, the focused editor also accepts Control-K for forward line deletion and Command-Backspace for backward line deletion.
- **Read only** disables editing and the delete/history controls. Reset controls deliberately replace the demo fixture.
- **Run acceptance matrix** checks actual layout, exact node content, history and command handling. It includes unmodified-editor negative controls; they pass only when the original unwanted deletion is reproduced.

## Scope and verification

This is a targeted workaround for a collapsed text caret, horizontal left-to-right normal flow and an inline decorator that shares the text's parent. It declines composition, read-only state, selected ranges, foreign selections, isolated nodes, slot-hosted content, token/segmented text, unsupported native selection APIs, transforms, out-of-flow positioning and non-baseline alignment. Declining means the existing editor handles the command; it does not repair those other cases or cancel the operation.

The checks use real browser layout, including plain/rich modes, span/button decorators, surrounding spaces, same-line deletion, two consecutive deletes, undo/redo, iframe and open Shadow DOM. Separate delegation checks require the extension callback to run and return false before a test fallback handles the command. The composition check sets Lexical's composition state; it is not a real IME typing test. See [verification.json](verification.json) for the recorded environment and result.

Browser checks are software-operated. No reporter adoption, human manual validation, Firefox/Safari compatibility or general bidirectional-text coverage is claimed. Test your own decorator styling before adopting it, and recheck after upgrading Lexical. Remove the extension when an upstream fix covers your workflow.

[PR #9247](https://github.com/facebook/lexical/pull/9247) fixes a different native-selection endpoint inside decorator DOM and explicitly leaves this soft-wrap issue unresolved. This example does not replace that repair.

License: MIT; see [LICENSE](LICENSE). Dependencies retain their own licenses.

## Optional coffee

If this saves you some time and you'd like to buy me a coffee, thank you. It is entirely optional; the source and example are free.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
