import {StrictMode, useCallback, useEffect, useState} from 'react'
import {flushSync} from 'react-dom'
import {createRoot} from 'react-dom/client'
import {
  Button,
  I18nProvider,
  Tree,
  TreeItem,
  TreeItemContent,
  useDragAndDrop,
} from 'react-aria-components'
import type {Key} from 'react-aria-components'
import './style.css'

type FixtureEvent = {type: string; operation?: string}
type EffectLifecycle = {setups: number; cleanups: number}

const effectLifecycle: EffectLifecycle = {setups: 0, cleanups: 0}

declare global {
  interface Window {
    dragFixture: {
      getEvents(): FixtureEvent[]
      getEffectLifecycle(): EffectLifecycle
      removeSource(): void
      unmountTree(): void
    }
  }
}

function EffectReplayProbe() {
  useEffect(() => {
    effectLifecycle.setups += 1
    return () => {
      effectLifecycle.cleanups += 1
    }
  }, [])
  return null
}

const direction = new URLSearchParams(window.location.search).get('dir') === 'rtl'
  ? 'rtl'
  : 'ltr'

function ItemContent({id, label, branch = false}: {id: string; label: string; branch?: boolean}) {
  return (
    <TreeItemContent>
      {({isExpanded}) => (
        <>
          <Button slot="drag" aria-label={`Drag ${label}`}>Move</Button>
          {branch && (
            <Button slot="chevron" aria-label={`Toggle ${label}`}>
              {isExpanded ? 'Collapse' : 'Expand'}
            </Button>
          )}
          <span>{label}</span>
          <small>{id}</small>
        </>
      )}
    </TreeItemContent>
  )
}

function DragTree({
  onRemoveSource,
  log,
}: {
  onRemoveSource(): void
  log(event: FixtureEvent): void
}) {
  const [expandedKeys, setExpandedKeys] = useState<Set<Key>>(
    new Set(['documents', 'photos']),
  )
  const [showImage2, setShowImage2] = useState(true)
  const [removeSourceOnMove, setRemoveSourceOnMove] = useState(false)

  const removeSource = useCallback(() => {
    flushSync(() => setShowImage2(false))
    onRemoveSource()
  }, [onRemoveSource])

  window.dragFixture.removeSource = removeSource

  const {dragAndDropHooks} = useDragAndDrop({
    getItems(keys) {
      return [...keys].map((key) => ({'text/plain': String(key)}))
    },
    getAllowedDropOperations: () => ['move'],
    onDragStart() {
      log({type: 'dragstart'})
    },
    onDragEnd(event) {
      log({type: 'dragend', operation: event.dropOperation})
    },
    onMove(event) {
      log({type: 'move', operation: event.dropOperation})
      if (removeSourceOnMove) {
        removeSource()
      }
    },
  })

  return (
    <section className="tree-panel" aria-label="File move fixture">
      <EffectReplayProbe />
      <label className="drop-removal">
        <input
          type="checkbox"
          checked={removeSourceOnMove}
          onChange={(event) => setRemoveSourceOnMove(event.currentTarget.checked)}
        />
        Remove the source synchronously during a successful move
      </label>
      <Tree
        aria-label="Files"
        selectionMode="multiple"
        expandedKeys={expandedKeys}
        onExpandedChange={(keys) => setExpandedKeys(new Set(keys))}
        dragAndDropHooks={dragAndDropHooks}
      >
        <TreeItem id="documents" textValue="Documents">
          <ItemContent id="documents" label="Documents" branch />
          <TreeItem id="budget" textValue="Budget">
            <ItemContent id="budget" label="Budget" />
          </TreeItem>
        </TreeItem>
        <TreeItem id="photos" textValue="Photos">
          <ItemContent id="photos" label="Photos" branch />
          <TreeItem id="image-1" textValue="Image 1">
            <ItemContent id="image-1" label="Image 1" />
          </TreeItem>
          {showImage2 && (
            <TreeItem id="image-2" textValue="Image 2">
              <ItemContent id="image-2" label="Image 2" />
            </TreeItem>
          )}
        </TreeItem>
      </Tree>
    </section>
  )
}

function App() {
  const [events, setEvents] = useState<FixtureEvent[]>([])
  const [treeMounted, setTreeMounted] = useState(true)

  const log = useCallback((event: FixtureEvent) => {
    setEvents((current) => [...current, event])
  }, [])

  window.dragFixture = {
    getEvents: () => events,
    getEffectLifecycle: () => ({...effectLifecycle}),
    removeSource: () => {},
    unmountTree: () => flushSync(() => setTreeMounted(false)),
  }

  return (
    <I18nProvider locale={direction === 'rtl' ? 'ar-AE' : 'en-US'}>
      <main dir={direction}>
        <h1>Keyboard drag cleanup fixture</h1>
        <p>Direction: <strong>{direction.toUpperCase()}</strong></p>
        <label className="outside-field">
          Outside editable input
          <input aria-label="Outside editable input" />
        </label>
        <button type="button" onClick={() => setTreeMounted((value) => !value)}>
          {treeMounted ? 'Unmount tree' : 'Mount tree'}
        </button>
        {treeMounted && <DragTree onRemoveSource={() => {}} log={log} />}
        <section aria-label="Event log" className="event-log">
          <h2>Event log</h2>
          <ol>
            {events.map((event, index) => (
              <li key={index}>{event.type}{event.operation ? `: ${event.operation}` : ''}</li>
            ))}
          </ol>
        </section>
      </main>
    </I18nProvider>
  )
}

const root = document.getElementById('root')
if (!root) {
  throw new Error('Missing #root fixture element')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
