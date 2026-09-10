# Keep unrelated fields quiet inside a reactive form group

A free MIT React component factory and TanStack Form example for isolating unrelated field work while preserving live input, validation and submission. The comparison uses React 19.3.0 and `@tanstack/react-form` 1.33.5.

[Download source and tests](../../downloads/isolated-form-fields-v0.1.0.zip?raw=true)

## Why this example exists

[TanStack Form #2377](https://github.com/TanStack/form/issues/2377), opened September 9, 2026, reports that changing one field inside a `FormGroup` rerenders all its children. The group has reactive value and metadata subscriptions, so its render callback can run again when any grouped value changes. A child rendered directly in that callback can therefore do extra work even if its own field value is unchanged.

This example puts the field list behind a stable memo boundary. The actual TanStack fields retain their own subscriptions. The group summary remains outside the boundary and continues to show current values and validation state. This is an application composition workaround; it does not patch TanStack Form or stop `FormGroup` itself from updating.

## Run the comparison

Extract the ZIP and open a terminal in `isolated-form-fields`. Use Node.js 22.22.2 or newer within Node 22, 24.15.0 or newer within Node 24, or 26.0.0 or newer. The executed runtime is Node.js 24.19.0.

```sh
npm ci --ignore-scripts
npm test
npm run typecheck
npm run build
npm start
```

Open the loopback URL printed by the preview server. The example uses invented names and keeps values and submission results in memory.

1. Leave related validation off. Change the first name twice in each panel. Compare the changes in committed-render counts: the original panel also updates its unrelated last-name field; the isolated panel keeps that field quiet while its first name and group summary update.
2. Enable related validation. Set the first name equal to the last name. The last-name error should update: these fields now have a declared dependency, so that sibling update is necessary. Correcting the first name clears the error.
3. Clear a field, move focus away and try submitting. Restore valid values and submit again to inspect the accepted values.
4. Disable and re-enable fields, edit the backup group, switch back, reset values and use Parent refresh. The memo boundary must not preserve stale props or overwrite another group's values.

The counters observe committed field/group views after render. They are diagnostics, not timing measurements. Compare deltas after mounting; development Strict Mode can change initial counts. No artificial expensive work is added to make the difference look larger.

## Copy the reusable component

Copy [MemoFieldSet.tsx](MemoFieldSet.tsx) and preserve [LICENSE](LICENSE). The factory depends only on React. It does not depend on TanStack Form, CSS, the demo model or the render counters.

```tsx
import { createMemoFieldSet } from './MemoFieldSet';

type Definition = Readonly<{
  name: 'firstName' | 'lastName';
  label: string;
  disabled: boolean;
}>;

// Create the component once, outside the parent component.
const Fields = createMemoFieldSet<Definition>();
const definitions: readonly Definition[] = [
  { name: 'firstName', label: 'First name', disabled: false },
  { name: 'lastName', label: 'Last name', disabled: false },
];

// In a form integration, this renderer wraps a field's own subscription.
function TextField({ name, label, disabled }: Definition) {
  return <label>{label}<input name={name} disabled={disabled} /></label>;
}

export function Names() {
  return <Fields fields={definitions} Field={TextField} />;
}
```

`createMemoFieldSet<T>()` returns a memoized component accepting `fields: readonly T[]` and `Field: ComponentType<T>`, where `T` includes a string `name`. Each definition is forwarded as props in array order, with `name` as its React key. Literal name unions and required custom props remain type checked.

Names must be nonempty, unique strings. Malformed definitions throw `TypeError`; an empty list is valid. Definitions are not modified. Use immutable updates when changing the definitions; mutating the same array in place can leave a memoized view stale.

## Bind it to TanStack Form

[DemoForm.tsx](DemoForm.tsx) contains the complete working binding. The essential composition is:

```tsx
const BoundField = form.Field;
const Field = useMemo(() => function TextField(definition: TextDefinition) {
  return (
    <BoundField name={definition.name}>
      {(field) => (
        <input
          aria-label={definition.label}
          disabled={definition.disabled}
          value={field.state.value}
          onChange={(event) => field.handleChange(event.target.value)}
          onBlur={field.handleBlur}
        />
      )}
    </BoundField>
  );
}, [BoundField]);
```

The runnable binding includes the complete types, validators and labels. Pass the stable renderer and memoized definitions to `Fields` inside the group callback. Keep the reactive group view beside `Fields` and outside its memo boundary.

Both `Field` and `fields` must retain identity across unrelated parent/group updates. Creating an inline renderer or a new array on every callback defeats shallow memoization. A changed group facade or the entire reactive values object also changes on every edit, so passing those objects as memo props defeats this boundary.

When an application changes the selected group, disabled state, labels or validator options, create new definitions with those changes. Their new identity deliberately refreshes the rendered fields. A field's own state, context and subscriptions still update through `React.memo`; dependent validation must continue to update too. Do not remove the library's group subscriptions or use a custom comparator that ignores changed props.

See the official [React memo reference](https://react.dev/reference/react/memo), [form composition guide](https://tanstack.com/form/latest/docs/framework/react/guides/form-composition) and [linked field validation guide](https://tanstack.com/form/latest/docs/framework/react/guides/linked-fields). `memo` is an optimization, not a semantic guarantee that React will never render again. This example does not enable React Compiler or establish compatibility with every compiler configuration.

## Verification

Verified with Node.js 24.19.0: 11 actual-library/runtime tests and a TypeScript consumer fixture pass, together with type checking and a production build. Tests cover field and group reactivity, unrelated and related-field behavior, focus/node identity, submission, reset, disabled props, scope changes and keys. Chrome checks confirmed the render-count comparison, current validation and submissions, group switching, reset, disabled fields, parent refresh and a 390px layout without horizontal overflow. Browser warning/error logs were empty. React Compiler, OS input methods and screen-reader behavior were not separately validated.

## License

Original code and invented example data are [MIT licensed](LICENSE). Preserve the license when copying. Keep [third-party notices](THIRD_PARTY_NOTICES.md) when redistributing the built example.

## Buy me a coffee, if this helped

This example is free. If it saves you some time and you feel like buying me a coffee, a small contribution is welcome. There is no obligation; useful feedback is appreciated too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please use the asset and network shown above.
