# Save a field array without losing newer edits

A copyable React Hook Form component and runnable local example for acknowledging a saved snapshot while keeping dynamic rows, focus and later edits intact. Free under the MIT license.

[Download source and tests](../../downloads/saved-field-array-v0.1.0.zip?raw=true)

## The integration problem

[Discussion #11770](https://github.com/orgs/react-hook-form/discussions/11770) describes dynamic rows remounting after a save calls `reset()`, with lost input focus and local row state. The related [default-value synchronization discussion](https://github.com/orgs/react-hook-form/discussions/8233) distinguishes the saved baseline from values the user is still editing.

React Hook Form provides [`resetDefaultValues`](https://react-hook-form.com/docs/useform/resetdefaultvalues) for updating defaults without replacing current values. The [changelog](https://github.com/react-hook-form/react-hook-form/blob/master/CHANGELOG.md) records its introduction in 7.77.0; this example targets and tests 7.87.0. The integration uses that public API directly.

The acknowledgement step in an existing save flow is:

```tsx
const submittedSnapshot = structuredClone(getValues());
const acknowledgedValues = await saveSnapshot(submittedSnapshot);
resetDefaultValues(acknowledgedValues);
```

Use the complete snapshot that was actually saved. Reading `getValues()` when the response arrives would incorrectly mark any later edits as saved. The complete component also validates before saving, handles failure and guards against overlapping submissions.

## Run the example

Extract the ZIP and open a terminal in `saved-field-array`. Use Node.js 22.22.2 or newer within Node 22, 24.15.0 or newer within Node 24, or 26.0.0 or newer. This range follows the locked dependencies; the executed runtime is Node.js 24.19.0.

```sh
npm ci --ignore-scripts
npm test
npm run typecheck
npm run build
npm start
```

Open the loopback URL printed by the preview server. React and React DOM are pinned to 19.3.0, React Hook Form to 7.87.0, Vite to 8.2.2 and TypeScript to 5.9.3. The example is a buildable React project, not an HTML file to double-click.

Try the following with the invented records:

1. Edit a name and save. Keep the same value until the local four-second save finishes: the form becomes clean.
2. Save another name, then continue typing before the save finishes. The newer text stays visible and unsaved; the acknowledged baseline shows the earlier submitted name.
3. Enter a local row note or select a local file, then save a name. Those controls belong to the retained row. Notes and files are not part of the saved data.
4. Try the next-save failure option. A failed save keeps the previous baseline and your unsaved text; retry can save it.
5. Add or remove a row while saving. An acknowledgement does not replace the current array or bring a removed row back.

The demo's delay and failure switch simulate transport entirely in memory. It makes no requests, uploads or storage writes. It is not a production persistence service.

## Copy the component

Copy [SavedFieldArray.tsx](SavedFieldArray.tsx) and [LICENSE](LICENSE) into a React TypeScript project with React Hook Form 7.87.0 installed. The component imports only React and React Hook Form. [style.css](style.css) supplies optional example styling.

```tsx
import { SavedFieldArray, type FormValues } from './SavedFieldArray';

const initialValues: FormValues = {
  items: [
    { recordId: 'record-A', name: 'Apricot' },
    { recordId: 'record-B', name: 'Birch' },
  ],
};

async function localSave(snapshot: FormValues): Promise<FormValues> {
  return snapshot;
}

export function Example() {
  return <SavedFieldArray initialValues={initialValues} saveSnapshot={localSave} />;
}
```

Replace `localSave` with your application's persistence callback. Resolve with a complete, validated snapshot that the server acknowledged, and reject on failure. The component sends a detached copy and permits one request at a time. It leaves inputs editable during the request and recalculates native `isDirty`/`dirtyFields` after acknowledgement.

`recordId` is the application's record identity. The rendered row key is React Hook Form's generated `field.id`, so retained rows keep their local state. Initial values apply when the form mounts; changing the prop is not a background refresh mechanism. The caller owns changing records and obtaining fresh initial data.

## Scope and tradeoffs

The sample uses explicit saves so the in-flight changes are easy to observe. In an existing autosave flow, replace the acknowledgement step after successful persistence with the same public API. This is not a scheduler, a multi-user conflict merger or a server write-ordering protocol.

`resetDefaultValues` updates the baseline; it does not apply server normalization to the currently displayed text. If a server returns a different canonical name, that difference remains unsaved in this example until the application decides how to reconcile it. Likewise, a removed row stays removed when an older snapshot is acknowledged. Use an explicit application flow when current values really must be replaced.

Names are validated as required before submission. Local notes and file controls are deliberately outside the saved form values; retaining a control does not upload or persist its content. Unmounting ignores later local acknowledgement updates but does not cancel an application-owned request. These boundaries belong to the caller's integration.

## Verification

The ten integration tests use actual ReactDOM and React Hook Form. They cover successful acknowledgement, later edits, detached snapshots, duplicate submissions, failure/retry, required names, row changes during saving, empty lists, mount-only initial values and response handling after unmount. Type checking and the production build pass on Node 24.19.0.

Chrome checks cover focus and text selection after acknowledgement, retained local notes, edits made during a request, failure/retry, and adding/removing rows during a save. At a 390px viewport the page has no horizontal overflow. The file-input test verifies retained DOM identity with a supplied files-like property; selecting a real file in Chrome was not verified because browser-extension file access was unavailable. Files are local-only and are never uploaded.

## License

Original code is [MIT licensed](LICENSE). Retain its license when copying it, and the included third-party notices when redistributing a built example.

## Buy me a coffee, if this helped

This example is free. If it saves you a little time and you feel like buying me a coffee, a small contribution is welcome. There is no obligation; useful feedback is appreciated too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please use the asset and network shown above.
