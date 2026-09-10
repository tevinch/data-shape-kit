# Remote field check

Using Ant Design? The separate [remote-rule example](../antd-remote-rule) keeps required and format errors immediate while handling debounce, cancellation and explicit validation inside Form rules.

A free, copyable JavaScript controller for debounced remote field checks, with React hooks and a working React Hook Form example. It keeps input updates immediate, stops unrelated fields from starting checks, and prevents an old response from replacing the current result.

[Download v0.1.0](https://github.com/tevinch/data-shape-kit/raw/refs/heads/main/downloads/remote-field-check-v0.1.0.zip), extract it, and open **demo.html**. The included demo uses only local simulated responses and bundled assets; no installation, account or backend is needed. Try `taken`, `slow`, `offline` and `timeout`, or submit immediately after typing `available`.

## What prompted this example

Four distinct React Hook Form threads describe related integration problems. This is a small qualitative sample, not a measure of how common the problems are or a claim that all four are current library defects.

| Community example | Concern addressed here |
| --- | --- |
| [Async validation per field #11942](https://github.com/orgs/react-hook-form/discussions/11942) | Keep remote work and its status with the affected field; avoid unrelated-field checks and stale results |
| [Async validation patterns #9005](https://github.com/orgs/react-hook-form/discussions/9005) | Keep ordinary local validation responsive while a remote check is pending; this discussion already has an accepted alternative |
| [Debounce async validation #40](https://github.com/react-hook-form/react-hook-form/issues/40) | Debounce expensive checks during typing; this historical issue is closed |
| [Debouncing onChange #7676](https://github.com/orgs/react-hook-form/discussions/7676) | Store input immediately so submitting before a debounce timer fires still sees the latest value; this discussion is answered |

The controller is independent of RHF's resolver. The example subscribes inside the affected field, while the parent owns the controller's lifetime. React's [Effect documentation](https://react.dev/reference/react/useEffect) explains why cleanup must exclude out-of-order responses; aborting a request alone cannot guarantee that its callback stops.

## Copy the core

Copy `remote-check.mjs` and, for TypeScript, its adjacent `remote-check.d.mts`. The core has no runtime dependencies. Supply a checker appropriate to your application:

```js
import { createRemoteCheck } from './remote-check.mjs';

const remote = createRemoteCheck(
  async (value, { signal }) => {
    // Your service adapter owns the endpoint, credentials and response parsing.
    // This local callback is a runnable substitute for that adapter.
    signal.throwIfAborted();
    return value === 'taken' ? 'This value is already in use.' : null;
  },
  { delayMs: 300, timeoutMs: 10_000 },
);

const stopListening = remote.subscribe(() => {
  console.log(remote.getSnapshot());
});

void remote.schedule('available'); // Debounced typing check.
const outcome = await remote.checkNow('available'); // Flush pending work.
if (outcome.status === 'valid' && remote.isCurrent(outcome)) {
  console.log('The current check passed.');
}
stopListening();
remote.cancel();
```

Your checker receives the original string and an `AbortSignal`. Return `null` when valid, or a non-whitespace string intended for the user when invalid. Synchronous values and promises are supported. Throws, rejections, and other return types produce an error outcome; they never imply validity. The form displays a fixed retry message for errors rather than exposing exception details.

## Controller contract

| API | Behavior |
| --- | --- |
| `schedule(value)` | Start after the debounce delay; replace a different active value |
| `checkNow(value)` | Flush an equal waiting check, share an equal running check, or start a new check immediately |
| `cancel()` | Return to idle, abort active work if possible, and promptly settle its promise as cancelled |
| `getSnapshot()` | Read an immutable snapshot; the same reference is retained until state changes |
| `subscribe(listener)` | Listen for state changes; returns an unsubscribe function. Listeners must be synchronous and must not throw |
| `isCurrent(outcome)` | True only for the exact terminal outcome still exposed as the current snapshot |

Active checks for an identical value share one promise without restarting the delay. A settled result is **not cached**: another submission checks again. A superseded or cancelled call resolves to `{ status: 'cancelled', value }` even if its checker ignores abort or never resolves. Late successes and failures cannot update the current snapshot. Callers must also check `isCurrent` before acting on an awaited result, including an A → B → A input sequence.

Snapshots are `idle`, `waiting`, `checking`, `valid`, `invalid` or `error`. All except idle carry `value`; invalid adds `message`. Errors have reason `timeout`, `check-failed` or `invalid-result`, and may retain the original `error` for deliberate diagnostics. Cancellation is a returned outcome, not a displayed error state.

`delayMs` defaults to 300 and accepts finite values from 0 through 2,147,483,647. `timeoutMs` defaults to 10,000 and accepts finite values from 1 through 2,147,483,647. A timeout starts when the checker executes, after any debounce delay. Aborting is best effort: an ignored signal cannot undo a server operation or stop a synchronously blocking callback. Use short, nonblocking checkers.

## React Hook Form integration

Copy the two core files, `use-remote-check.ts` and `slug-form-example.tsx` into your React project. Keep the checker stable across renders, for example by defining it at module scope or using `useCallback` with the dependencies that actually affect the check. Changing the checker or timing options creates a new controller and cancels the previous one.

```tsx
import { SlugFormExample } from './slug-form-example.js';
import type { RemoteChecker } from './remote-check.mjs';

const checkSlug: RemoteChecker = async (slug, { signal }) => {
  signal.throwIfAborted();
  // Replace this demonstration rule with your service adapter.
  return slug === 'taken' ? 'Choose another slug.' : null;
};

export function Example() {
  return <SlugFormExample check={checkSlug}
    onAccepted={(values) => {
      // Replace with your operation. The server must validate again.
      console.log(values.slug, values.note);
    }} />;
}
```

The supplied form applies the same local rule to RHF validation and remote scheduling: 3–32 lowercase ASCII letters, digits or hyphens, starting and ending with a letter or digit. Local errors take priority over remote status. Its `Note` field remains local.

Typing calls RHF's registered `onChange` immediately, then schedules or cancels the side effect. Submitting first runs RHF's local rules, then calls `checkNow` with the current slug. It invokes `onAccepted` only for a valid, still-current outcome matching `getValues('slug')`. Form controls are disabled while submitting, and operation failures show a retry message. Reset cancels before resetting the fields.

For another form, use `useRemoteCheckController(check, options)` in its owner and `useRemoteCheckState(controller)` in the affected field. These are separate hooks so subscribing to remote status need not rerender the owner. Cleanup cancels work, including during React StrictMode's development effect replay.

**Programmatic changes need the same coordination.** If your application uses RHF's `setValue`, also schedule the new eligible value or cancel the old check. Before a programmatic reset, cancel. The component does not observe arbitrary form mutations, and it does not debounce the input's own update.

RHF's `isValid` describes its local rules or schema; it is not a sufficient remote-submission gate in this example. RHF documents the behavior of [setError](https://github.com/react-hook-form/documentation/blob/master/src/content/docs/useform/seterror.mdx) and [clearErrors](https://github.com/react-hook-form/documentation/blob/master/src/content/docs/useform/clearerrors.mdx); the example keeps the remote lifecycle explicit instead of relying on a manual error surviving later validation.

An availability response is only feedback at the time of that check. It is not a reservation, a uniqueness guarantee or authorization. Validate at the actual server operation. The component does not choose an HTTP endpoint, send requests itself, normalize values, implement authentication or cache results across fields.

## Develop and verify

From this directory, with Node.js 22 or newer and npm:

```sh
npm install --ignore-scripts
npm test
npm run typecheck
npm run build:demo
```

The test setup is pinned to React and React DOM 19.3.0, React Hook Form 7.87.0, TypeScript 5.9.3, jsdom 25.0.0 and esbuild 0.25.5. Verification used Node.js 24.19.0; other runtime combinations have not been verified here. The core needs modern JavaScript, `AbortController`, promises and timers. Copy the React files into your project's normal TypeScript/bundler setup; the `.js` relative imports follow TypeScript's emitted-module convention.

Tests use controlled promises and timers plus actual React/RHF rendering in jsdom. They cover debounce, active-value sharing, immediate submit, stale responses, ignored abort, timeouts, reset, StrictMode, local validation, field-only subscriptions and visible operation errors. `test-demo.mjs` separately checks the demo service simulation. No test calls a live service. Browser checks used a local HTTP server; opening a file URL was not separately verified.

The ready-to-open demo is generated from the same example. `build-demo.mjs` bundles dependencies into `demo.js` and collects their license notices in `THIRD_PARTY_NOTICES.txt`. Keep those notices with the bundled demo. The source is [MIT-licensed](LICENSE).

## Buy me a coffee, if this helped

If this saved you a little time, you're welcome to buy me a coffee. Please don't feel obliged — the code stays free, and feedback with a small reproducible example is appreciated too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please match the asset and network exactly. Fees depend on your wallet or exchange. Thank you! — Tevinch
