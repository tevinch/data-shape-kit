# Debounced remote rules for Ant Design

Show required and format errors immediately while delaying only an expensive remote check. This copyable MIT example uses the existing [Remote field check](../remote-field-check) controller and Ant Design's normal rule promises. It handles cancellation, stale responses and an explicit validation path that skips the debounce.

The concrete need is described in [Ant Design #58836](https://github.com/ant-design/ant-design/issues/58836), following [#44585](https://github.com/ant-design/ant-design/issues/44585). This is an application-level custom-rule pattern. It does not add a native per-rule `validateDebounce` property to Ant Design.

## Use the example

Download the [source ZIP](../../downloads/antd-remote-rule-v0.1.0.zip?raw=true), extract both sibling directories, then run:

```sh
cd antd-remote-rule
npm ci --ignore-scripts
npm test
npm run typecheck
```

Node.js 22 or newer is required. The pinned fixture uses Ant Design 6.6.3, React 19.3.0, TypeScript 5.9.3 and JSDOM 25.0.0. Dependencies are for running the React example and its checks; the small rule bridge adds no network client or persistence.

For an existing React/Ant Design application, copy `code-form-example.tsx`, `debounced-rule.mjs`, `debounced-rule.d.mts` and the license. Also copy `remote-check.mjs`, `remote-check.d.mts` and its license from the sibling `remote-field-check` directory, keeping the relative layout or adjusting the imports.

```tsx
import { CodeForm } from './antd-remote-rule/code-form-example.js';

// Synthetic example: replace with your application's stable checker.
// Return null for success or a nonblank user-facing message for failure.
const checkCode = async (value: string, { signal }: { signal: AbortSignal }) => {
  signal.throwIfAborted();
  return value === 'already-used' ? 'Code already exists' : null;
};

export function Example() {
  return <CodeForm checkCode={checkCode} delayMs={500}
    onValid={(values) => { console.log(values.code); }} />;
}
```

The included form accepts 3–32 lowercase letters, digits and hyphens, starting with a letter. This is an example policy, not an Ant Design restriction. Replace both the local rule and eligibility predicate together for your own field. Keep `checkCode` stable with a module function or `useCallback`.

## The important wiring

Use `validateFirst="parallel"` with **no field-level `validateDebounce`**. Local rules can then fail immediately, and the remote rule also runs for an invalid new value so it can cancel earlier work. The eligibility predicate prevents requests for locally invalid input.

```tsx
<Form.Item name="code" validateFirst="parallel" rules={[
  { required: true, whitespace: true, message: 'Code is required' },
  { pattern: CODE_PATTERN, message: 'Code format is invalid' },
  { validator: rule.validator },
]}>
  <Input />
</Form.Item>
```

The bridge checks the current form value before scheduling and again after receiving a result. Superseded validation rejects instead of approving a value that was never checked. Ant Design's own validation promise tracking prevents an old rule result from replacing a newer field result. A checker that ignores its abort signal still cannot return a current success after cancellation.

A pending validation of the same value shares the same request. Once a result has settled, validating again makes a fresh check. The default delay is 300 ms; the default timeout is 10 seconds **from the request start**, excluding the debounce period.

## Submit and explicit validation

Wrap the actual promise-returning validation:

```ts
const values = await rule.runImmediately(() => form.validateFields());
// Use values only after this succeeds.
```

This flushes a waiting same-value check and keeps immediate mode active until validation settles. Nested or overlapping calls are supported. The included `CodeForm` uses an outer native `<form>` for the submit event and an inner `<Form component={false}>` for Ant Design's field store and validation. Clicking its submit button or submitting with Enter uses the same wrapper.

This example calls your `onValid` callback after `validateFields` succeeds. It does not use Ant Design's `onFinish` or `form.submit()`. Do not wrap `form.submit()` in `runImmediately`: it returns `void`, so the immediate scope would end before validation finishes. Calling `form.validateFields()` directly still works, but eligible remote checks retain their ordinary delay.

For programmatic value replacement or reset, explicitly cancel first:

```ts
rule.cancel();
form.setFieldValue('code', 'replacement');
// Or: rule.cancel(); form.resetFields();
```

Ant Design does not dispatch `onValuesChange` for `setFieldValue`/`setFieldsValue`. The current-value guard prevents a stale success even if you forget cancellation, but explicit cancellation also avoids unnecessary work. Unmount cleanup cancels the rule. Resetting validation does not undo an operation your application has already started after successful validation.

## Bridge API

```ts
const rule = createDebouncedRule(checkCode, {
  getValue: () => form.getFieldValue('code'),
  isEligible: value => CODE_PATTERN.test(value),
  delayMs: 500,
  timeoutMs: 10000,
  errorMessage: 'Unable to validate. Please try again.',
});
```

- `validator(_rule, value)` returns a promise compatible with a custom Ant Design rule. Local rules must reject values excluded by `isEligible`; the remote bridge deliberately skips them.
- `runImmediately(callback)` returns the callback's awaited result and preserves its rejection. While it is pending, this rule's eligible validations start immediately.
- `cancel()` aborts and settles pending work. The instance remains reusable.

Create a separate instance for each field. This example covers a single string value; include changes to any dependent validation context in your own cancellation policy. Checker exceptions, malformed replies and timeouts use the generic `errorMessage`; intentionally returned validation messages are displayed as supplied.

## What is verified

The checks exercise actual Ant Design Form components in JSDOM, with synthetic input events and controllable checker promises: immediate local failures, debounced changes, old responses arriving late, clearing, native submit, explicit validation, reset, programmatic replacement and unmount. The bridge tests cover its promise and timing contracts independently. The fixture pins the installed dependencies; `package-lock.json` records them.

These checks do not establish browser layout, native keyboard behavior in every browser, or a real backend's uniqueness guarantee. Server-side constraints must still be checked when the application commits its operation. No real API, account registration or user data is used here.

Official references: [Form API, validation and programmatic updates](https://ant.design/components/form/) and [the Form field implementation](https://github.com/react-component/field-form/blob/master/src/Field.tsx).

## Buy me a coffee, if this helped

If this saved you a little time, you're welcome to buy me a coffee. Please don't feel obliged — the code stays free, and feedback with a small reproducible example is appreciated too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please match the asset and network exactly. Fees depend on your wallet or exchange. Thank you! — Tevinch
