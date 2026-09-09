# Number Input

Free, copyable Zod 4 schemas and a React Hook Form example that distinguish an empty field from a real zero. Keep editable form values as strings or numbers, then submit validated numbers. The original example code is MIT licensed.

## Download and run

[Download the source ZIP](https://github.com/tevinch/data-shape-kit/raw/refs/heads/main/downloads/number-input-v1.0.0.zip). Extract it and run inside the `number-input` directory with Node.js 22.12 or newer:

```sh
npm ci --ignore-scripts
npm test
npm run typecheck
npm run build
npm run preview
```

Open the local URL printed by the preview command. The form runs locally and makes no data requests or storage calls. Development mode is available with `npm run dev`.

Try submitting both fields blank, entering a required count of `0`, leaving the optional measurement empty, loading numeric values, and resetting to blank. The demo shows editing values separately from the last valid submission. An omitted optional value disappears when the submission is displayed with `JSON.stringify`; that is JSON serialization behavior.

## Copy only the schemas

Copy [number-input.ts](number-input.ts) and [LICENSE](LICENSE), then install the one dependency needed by the schemas:

```sh
npm install --save-exact zod@4.6.1
```

```ts
import { z } from 'zod';
import { optionalNumberInput, requiredNumberInput } from './number-input';

const schema = z.object({
  count: requiredNumberInput.pipe(z.number().int().min(0).max(100)),
  measurement: optionalNumberInput.pipe(
    z.number().min(0).max(100).optional(),
  ),
});

schema.parse({ count: '0', measurement: '' });
// { count: 0, measurement: undefined }

schema.safeParse({ count: '', measurement: '12.5' }).success;
// false: the required count is still empty
```

The essential preprocessing step is short. It uses Zod's public API:

```ts
type NumberInputValue = string | number | null | undefined;

const optionalNumberInput = z.preprocess((value: NumberInputValue) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') {
    const text = value.trim();
    return text === '' ? undefined : Number(text);
  }
  return value;
}, z.number({ error: 'Enter a finite number.' }).optional());

const requiredNumberInput = optionalNumberInput.pipe(
  z.number({ error: 'Enter a number.' }),
);
```

The explicit parameter annotation gives both schemas the input type `string | number | null | undefined`. The optional output is `number | undefined`; the required output is `number`. Zod 4 documents this way to [narrow a preprocessor's input type](https://zod.dev/api#preprocess). No type assertion or Zod internals are needed.

Put `.optional()` on the **destination number schema**, as in the first example. An outer `.optional()` sees the original input; it does not automatically make an empty string acceptable to a required preprocessor. Use the optional export when empty values should succeed.

## Input policy

| Input | Optional schema | Required schema |
| --- | --- | --- |
| `''`, whitespace-only text, `null`, `undefined` | `undefined` | Error |
| `0`, `'0'`, `' 0 '` | `0` | `0` |
| Finite numbers, including negative values | Same number | Same number |
| Decimal text such as `'12.5'` | `12.5` | `12.5` |
| Scientific notation such as `'1e2'` | `100` | `100` |
| JavaScript numeric prefixes such as `'0x10'` | `16` | `16` |
| Invalid text, `NaN`, infinite values | Error | Error |
| Booleans, arrays, objects, bigint, symbols | Error | Error |

This example deliberately treats `null` as empty. Nonempty strings use JavaScript `Number`, including hexadecimal, binary and octal notation. It does not use `parseInt` or `parseFloat`, which can accept only a prefix of some invalid strings. It never passes objects, arrays or booleans into `Number`.

The core schemas accept finite negative numbers; the demo's additional `0`–`100` bounds reject them. Add your own domain constraints after conversion. JavaScript numbers use floating-point representation: conversion can round values, and these helpers do not promise exact decimal arithmetic or safe integers. Use an appropriate text or exact-number representation when precision must be retained.

There is no locale or formatting parser here. Decimal commas, grouping separators and unit suffixes need an explicit policy. Do not treat every rejected or partially typed value as empty: the user may need to correct it.

## React Hook Form: input and output are different

The included [form schema](form-schema.ts) exports `FormInput` and `FormOutput`. The [runnable component](App.tsx) passes both to React Hook Form:

```tsx
const form = useForm<FormInput, unknown, FormOutput>({
  resolver: zodResolver(formSchema),
  defaultValues: { count: '', measurement: '' },
});
```

Use this inside a React component, with `useForm` imported from `react-hook-form`, `zodResolver` from `@hookform/resolvers/zod`, and the types and schema from `form-schema.ts`. The resolver's [official TypeScript guidance](https://github.com/react-hook-form/resolvers#typescript) describes the separate input and output generics.

`watch` and `Controller` work with the editing input type. A successful `handleSubmit` callback receives the parsed output type. Typing the entire form with `z.infer` alone can incorrectly require both sides to be the same; `z.infer` describes the output.

For controlled fields, retain `field.value ?? ''` and send the original change event to `field.onChange`. This preserves a numeric `0` loaded through `reset` and keeps blank inputs controlled. Do not use `value || ''`, which would hide zero. Keep `field.ref` and `field.onBlur` for focus and touched-state behavior.

The example uses text controls with `inputMode="decimal"` so invalid or partial text remains available for validation. `inputMode` is a keyboard hint, not a format constraint. Native `type="number"` controls have their own sanitization and step behavior; changing to them requires checking those browser behaviors. Avoid adding `valueAsNumber` to this integration: it introduces `NaN` before the schema can distinguish blank input. The schema already owns conversion.

The form has no submit endpoint. A successful submission is displayed locally. Editing, loading values or resetting clears the previous submission display so it cannot be mistaken for the current form's result.

## Why this example exists

[Zod discussion #2814](https://github.com/colinhacks/zod/discussions/2814) describes empty strings becoming zero and later asks for distinct input/output types without casts. [React Hook Form discussion #6980](https://github.com/orgs/react-hook-form/discussions/6980) independently documents optional numeric inputs producing `NaN`, with continued discussion in 2026. These are recurring examples of a need, not a measurement of prevalence.

The earlier answers already establish useful approaches, including preprocessing and `setValueAs`. This example combines an explicit empty-value policy with Zod 4 input annotations, resolver output types, tests and a runnable controlled form. Coercion is behaving as JavaScript specifies; this is an application integration recipe, not a Zod patch.

## Verification and versions

The source contains runtime schema tests, calls to the actual Zod resolver, and compile-time input/output checks. The demo is built from the same schemas. All 10 runtime tests, strict TypeScript checks and the production build passed in both the source checkout and a fresh extraction of the download. Chrome checks covered blank required values, zero with a blank optional field, decimal input, invalid text, numeric values loaded through reset, and clearing the form. The layout was also checked at a 390-pixel viewport without horizontal overflow.

The download pins Zod 4.6.1, React/React DOM 19.3.0, React Hook Form 7.87.0 and resolvers 5.9.1. Development tools are TypeScript 5.9.3, Vite 8.2.2 and tsx 4.23.13. The schema module needs only Zod; the remaining runtime packages serve the form example. Keep dependency licenses with their packages.

## Buy me a coffee, if this helped

If this saved you some time, you're welcome to buy me a coffee. Please don't feel obliged — the code stays free, and useful feedback is welcome too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please match the asset and network exactly. Fees depend on your wallet or exchange. Thank you! — Tevinch
