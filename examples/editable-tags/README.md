# Edit text tags without deleting them

A free MIT component for correcting an existing React-Select tag while keeping its ID and position. Click a tag's edit button, change the full text in a native input, then save or cancel. The example uses React-Select 5.10.2 and controlled React state.

[Download source and tests](../../downloads/editable-tags-v0.1.0.zip?raw=true)

## Why this example exists

The inability to edit a created value appears in [React-Select #4982](https://github.com/JedWatson/react-select/issues/4982) and [Editable MultiValue #3204](https://github.com/JedWatson/react-select/issues/3204). Community examples and alternative autocomplete libraries already address parts of this problem. This example supplies a copyable flow for user-owned text tags, with stable IDs, explicit save/cancel and checks against conflicting parent updates.

Each tag has two fields: `id` identifies the record; `text` is the editable wording. A spelling correction changes `text` while preserving `id`. This component does not rename entries in a remote or shared option catalog.

## Run the example

Extract the ZIP and open a terminal in `editable-tags`. Use Node.js 22.22.2 or newer within Node 22, 24.15.0 or newer within Node 24, or 26.0.0 or newer. The executed runtime is Node.js 24.19.0.

```sh
npm ci --ignore-scripts
npm test
npm run typecheck
npm run build
npm start
```

Open the loopback URL printed by the preview server. React and React DOM are pinned to 19.3.0, and React-Select to 5.10.2. The example uses invented data and makes no requests to a data service. It does not upload or store tag values.

Try these flows:

1. Edit `Spreadsheet import guid` to `Spreadsheet import guide`. The ID stays `import-guide`, the other tags remain, and one change is reported.
2. Try a blank value or ` csv CHECKS `. Neither replaces the tag; the duplicate comparison ignores surrounding whitespace and letter case.
3. Change text and press Escape or Cancel. The committed value remains unchanged. Moving focus away alone retains the draft.
4. Open an edit, then use `Change first tag externally`. Saving the older draft reports a conflict. Cancel and reopen to edit the latest text.
5. Type a new tag in the select and create it. Its ID is generated once. Existing tags can also be removed through the select.
6. Try `Disable editing`, page resizing and the external-removal control. A removed tag cannot be brought back by saving an old draft.

The select is disabled while its separate editor is open, so creating/removing tags or opening another edit cannot discard the pending draft. Save commits it; Cancel discards it. If the parent disables the component during editing, the draft remains and Cancel is still available.

## Copy the component

Copy these files together and preserve [LICENSE](LICENSE):

- [EditableTagSelect.tsx](EditableTagSelect.tsx)
- [EditableTagSelect.css](EditableTagSelect.css)
- [tag-edits.mjs](tag-edits.mjs)
- [tag-edits.d.mts](tag-edits.d.mts)

Install the React/React DOM/React-Select versions used by the example, then import the scoped CSS explicitly:

```tsx
import { useState } from 'react';
import { EditableTagSelect } from './EditableTagSelect';
import type { Tag } from './tag-edits.mjs';
import './EditableTagSelect.css';

export function TagsField() {
  const [tags, setTags] = useState<readonly Tag[]>([
    { id: 'guide', text: 'Import guid' },
  ]);

  return (
    <EditableTagSelect
      inputId="document-tags"
      label="Document tags"
      value={tags}
      onChange={setTags}
    />
  );
}
```

The component accepts `value`, `onChange`, a unique `inputId`, `label`, optional `isDisabled`, and optional `createId`. The default ID factory calls `crypto.randomUUID()` when creating a tag. The default requires a browser with [randomUUID support in a secure context](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID). Supply `createId={() => yourIdFactory()}` if the host application owns ID allocation. IDs must be nonempty and unique. Each instance needs a distinct input ID.

Treat `onChange` as the next committed array and update controlled state. The component does not persist records to a server or wait for a remote save. The separate native editor supports cursor movement and selection. Enter saves and Escape cancels; composition Enter is guarded so confirming composed input does not also save the tag.

The integration uses public `MultiValueLabel`, `onCreateOption`, `getOptionValue` and `getOptionLabel` APIs. The edit input is outside React-Select's control, keeping edit keys away from its tag-removal behavior. The tag edit button is a native keyboard-focusable button; focus returns after save/cancel. The underlying select retains the library's other keyboard behavior.

## Use the data operations alone

The two exported functions have no runtime dependencies:

```js
import { commitTagEdit, appendTag } from './tag-edits.mjs';

const tags = [
  { id: 'guide', text: 'Import guid' },
  { id: 'checks', text: 'CSV checks' },
];

const result = commitTagEdit(tags, {
  id: 'guide',
  originalText: 'Import guid',
  draft: ' Import guide ',
});

if (result.ok) {
  console.log(result.value[0]); // { id: 'guide', text: 'Import guide' }
  console.log(result.value[1] === tags[1]); // true
}

const added = appendTag(tags, 'notes', 'PDF notes');
```

| Result | Meaning |
| --- | --- |
| `{ ok: true, value, changed: true }` | A new array contains the accepted change. |
| `{ ok: true, value, changed: false }` | No change is needed; the original array is returned. |
| `{ ok: false, reason, message }` | The operation was rejected without modifying input. |

Failure reasons are `blank`, `duplicate`, `duplicate-id`, `missing` and `conflict`. Malformed argument structures throw `TypeError`. Existing tag objects may contain extra properties; a rename preserves them, the tag order and all unrelated objects.

An edit checks `originalText` against the latest tag with that ID before replacing it. If it changed or disappeared, resolve that state in the application instead of blindly applying an old draft. Unrelated parent updates remain in the result.

New/saved text uses JavaScript `trim()`. Duplicate comparison uses trimmed whole-string JavaScript lowercasing. It is not locale collation, accent folding or full Unicode case folding. Text is rendered as text, including characters such as `<`, `>` and `&`.

## Verification

Verified with Node 24.19.0: 23 tests (16 pure-operation tests and 7 real React-Select component scenarios), TypeScript checking and the production build pass. Independent Chrome checks covered keyboard editing, native copy/paste, save/cancel, validation, creation/removal, external-update conflicts, disabled state and a 390px layout without horizontal overflow. Browser warning/error logs were empty. The composition-key guard is covered by simulated test events; actual OS IME and screen-reader behavior have not been validated.

## License

Original code and example data are [MIT licensed](LICENSE). Preserve that license when copying. Keep the included third-party notices when redistributing a built example.

## Buy me a coffee, if this helped

This example is free. If it saves you some time and you feel like buying me a coffee, a small contribution is welcome. There is no obligation; useful feedback is appreciated too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please use the asset and network shown above.
