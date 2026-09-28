# Keep conditional React Hook Form fields separate

A saved registration number can appear in a newly selected date field when two conditional, uncontrolled inputs occupy the same place in the React tree. [React Hook Form #13801](https://github.com/react-hook-form/react-hook-form/issues/13801) provides the concrete workflow: NSW → number `111` → Continue → Go back → QLD. The date should start as `_default_date`, but shows `111`.

## The small change

Give the two input elements different, stable keys tied to their field names:

```jsx
// In the NSW branch:
<input key="number" defaultValue="_default_number" {...register("number")} />

// In the QLD branch:
<input key="date" defaultValue="_default_date" {...register("date")} />
```

Keep the existing `useForm`, `defaultValues`, save and return code. The keys belong on the conditional inputs. Do not use a random key or a key that changes on each keystroke.

Without those keys, the example reuses one DOM input when switching from `number` to `date`. Its live value can survive that switch, even though its `name` and `defaultValue` change. In the reproduced case, the wrong value also enters submitted form data. The keyed inputs get separate DOM identities, so registration starts with the correct new field value.

React documents how [keys control identity](https://react.dev/learn/preserving-and-resetting-state#resetting-a-form-with-a-key) and how an uncontrolled input's [defaultValue supplies its initial value](https://react.dev/reference/react-dom/components/input#providing-an-initial-value-for-an-input). Changing `defaultValue` is not a general way to overwrite an existing input's current value.

This fixes the demonstrated application pattern; it is not a patch to React Hook Form. The example retains its default `shouldUnregister: false` behavior: previously entered named fields remain in form data when hidden. If your application intentionally removes inactive fields, treat that as a separate data policy and test it explicitly.

## Run the comparison

Download [the source ZIP](../../downloads/conditional-field-identity-source.zip?raw=true), or use this directory with Node.js 20 or newer:

```sh
npm ci --ignore-scripts
npm run build
npm start
```

Open `http://127.0.0.1:8774`. The example pins React / React DOM 19.3.0 and React Hook Form 7.89.0. It serves the local bundle; form data stays in the page's memory.

**Use distinct field keys** switches between the original identity behavior and the two-key correction. Changing that comparison or pressing **Reset example** deliberately starts a fresh form and submission history. Ordinary State changes and Continue / Go back keep the workflow's values.

## Repeat the verification sequence

1. With keys enabled, select NSW, enter `111` as the registration number and Continue. The submitted record must contain `number: "111"`.
2. Go back, confirm the restored number, then select QLD. The date must show `_default_date`; **Last field switch** must show `sameDOMNode: false`. Continue and check the actual submitted date.
3. Go back, change the date to `2026-09-28`, change Name to `Alex`, and Continue.
4. Go back, select NSW, confirm number `111`, change it to `222`, and Continue. The saved date and name must remain.
5. Go back, select QLD and Continue again. Submission count must reach five, with number `222`, date `2026-09-28` and name `Alex`.
6. Disable distinct keys to start a fresh comparison, then repeat steps 1–2. The original failure is date `111` and `sameDOMNode: true`.

The original hosted reproduction and this local comparison were checked in Chrome 152 on macOS using software-operated browser controls. The local sequence reached five real submit callbacks with the expected values. See [verification.json](verification.json). This is recorded browser verification and a repeatable checklist, not an automated test runner. Other browsers, custom input components, `Controller`, field arrays and different unregister settings are not covered by this example.

License: MIT for this example; dependencies retain their own licenses.

## Optional coffee

If this saves you some time and you'd like to buy me a coffee, thank you. It is entirely optional; the guide and source are free.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
