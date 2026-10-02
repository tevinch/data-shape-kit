import React, { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions } from '@headlessui/react'

const params = new URLSearchParams(location.search)
const virtual = params.get('virtual') === '1'
const multiple = params.get('multiple') === '1'
const ordered = params.get('order') === '1'
const isStatic = params.get('static') === '1'
const count = Number(params.get('count') || 1000)
const allOptions = Array.from({ length: 10000 }, (_, index) => `Item ${index}`)
const metrics = { inputEvents: 0, changes: [], samples: [], version: React.version, virtual, multiple, ordered, isStatic }

function snapshot() {
  const input = document.querySelector('[role="combobox"]')
  return {
    input: input?.value,
    optionCount: document.querySelectorAll('[role="option"]').length,
    selected: document.querySelector('#selection')?.textContent,
    activeId: input?.getAttribute('aria-activedescendant'),
    selectedLabels: [...document.querySelectorAll('[role="option"][aria-selected="true"]')].map((el) => el.textContent),
  }
}
function publish() {
  document.querySelector('#metrics').textContent = JSON.stringify({ ...metrics, current: snapshot() }, null, 2)
}
document.addEventListener('input', (event) => {
  if (event.target.getAttribute('role') !== 'combobox') return
  const start = performance.now()
  metrics.inputEvents++
  requestAnimationFrame(() => {
    metrics.samples.push({ input: event.target.value, durationMs: performance.now() - start, trusted: event.isTrusted, ...snapshot() })
    publish()
  })
}, true)

function App() {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(multiple ? ['Item 7'] : 'Item 7')
  const matches = allOptions.filter((value) => value.includes(query))
  const options = matches.slice(0, count)
  const disabled = (value) => value === 'Item 0' || value === 'Item 10'
  const option = (value, index) => <ComboboxOption
    key={value}
    value={value}
    disabled={disabled(value)}
    order={ordered ? index : undefined}
    className="option"
  >{value}</ComboboxOption>
  return <>
    <h1>Combobox interaction check</h1>
    <p>Matches: {matches.length}. Option limit: {count}. Mode: {virtual ? 'virtual' : 'normal'}.</p>
    <Combobox
      value={selected}
      multiple={multiple}
      virtual={virtual ? { options, disabled } : undefined}
      onChange={(value) => {
        metrics.changes.push(value)
        setSelected(value)
        requestAnimationFrame(publish)
      }}
      onClose={() => setQuery('')}
    >
      <div className="input-row">
        <ComboboxInput aria-label="Item" displayValue={(value) => multiple ? '' : value || ''} onChange={(event) => setQuery(event.target.value)} />
        <ComboboxButton>Show options</ComboboxButton>
      </div>
      <ComboboxOptions static={isStatic} className="options">
        {virtual ? ({ option: value }) => option(value) : options.map(option)}
      </ComboboxOptions>
    </Combobox>
    <p id="selection">{JSON.stringify(selected)}</p>
    <button onClick={publish}>Read state</button>
    <pre id="metrics" aria-label="Metrics"></pre>
  </>
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
