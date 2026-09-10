import { useState } from 'react';

import { EditableTagSelect } from './EditableTagSelect';
import type { Tag } from './tag-edits.mjs';

const INITIAL_TAGS: readonly Tag[] = [
  { id: 'import-guide', text: 'Spreadsheet import guid' },
  { id: 'csv-checks', text: 'CSV checks' },
  { id: 'ui-notes', text: 'UI notes' },
];

function freshInitialTags() {
  return INITIAL_TAGS.map((tag) => ({ ...tag }));
}

export function App(): React.JSX.Element {
  const [tags, setTags] = useState<readonly Tag[]>(freshInitialTags);
  const [changeEvents, setChangeEvents] = useState(0);
  const [disabled, setDisabled] = useState(false);
  const [exampleKey, setExampleKey] = useState(0);

  const reset = () => {
    setTags(freshInitialTags());
    setChangeEvents(0);
    setDisabled(false);
    setExampleKey((current) => current + 1);
  };

  return (
    <div className="page-shell">
      <main className="demo-card">
        <p className="eyebrow">React-Select free-text tags</p>
        <h1>Edit a tag without deleting it</h1>
        <p className="intro">
          Fix a typo while keeping the tag&apos;s stable ID and its place in the
          controlled value.
        </p>

        <section aria-labelledby="editor-heading" className="demo-section">
          <h2 id="editor-heading">Try the editor</h2>
          <EditableTagSelect
            key={exampleKey}
            value={tags}
            inputId="project-tags"
            label="Project tags"
            isDisabled={disabled}
            onChange={(next) => {
              setTags(next);
              setChangeEvents((count) => count + 1);
            }}
          />
          <p className="hint">
            Use the tag text button to edit. Enter saves and Escape cancels;
            the visible buttons do the same. Duplicate checks ignore case and
            surrounding spaces. If the same tag changes externally, cancel and
            reopen it to use the latest text.
          </p>
        </section>

        <section aria-labelledby="controls-heading" className="demo-section">
          <h2 id="controls-heading">Controlled-state checks</h2>
          <div className="demo-controls">
            <button type="button" onClick={reset}>
              Reset example
            </button>
            <button
              type="button"
              disabled={tags.length === 0}
              onClick={() =>
                setTags((current) =>
                  current.map((tag, index) =>
                    index === 0 ? { ...tag, text: 'Updated elsewhere' } : tag,
                  ),
                )
              }
            >
              Change first tag externally
            </button>
            <button
              type="button"
              disabled={tags.length === 0}
              onClick={() => setTags((current) => current.slice(1))}
            >
              Remove first tag externally
            </button>
            <label className="checkbox-control">
              <input
                type="checkbox"
                checked={disabled}
                onChange={(event) => setDisabled(event.target.checked)}
              />
              Disable editing
            </label>
          </div>
        </section>

        <section aria-labelledby="value-heading" className="demo-section">
          <div className="value-heading-row">
            <h2 id="value-heading">Committed value</h2>
            <p>
              Change events: <strong>{changeEvents}</strong>
            </p>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Text</th>
                  <th scope="col">ID</th>
                </tr>
              </thead>
              <tbody>
                {tags.length ? (
                  tags.map((tag) => (
                    <tr key={tag.id}>
                      <td>{tag.text}</td>
                      <td>
                        <code>{tag.id}</code>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2}>No committed tags</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className="coffee-footer">
        <p>If this example saved you time, you can optionally buy me a coffee:</p>
        <dl>
          <div>
            <dt>USDC / SOL · Solana:</dt>
            <dd>
              <code>9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy</code>
            </dd>
          </div>
          <div>
            <dt>USDC / ETH · Base:</dt>
            <dd>
              <code>0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA</code>
            </dd>
          </div>
          <div>
            <dt>USDT · BNB Smart Chain (BEP20):</dt>
            <dd>
              <code>0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA</code>
            </dd>
          </div>
        </dl>
      </footer>
    </div>
  );
}
