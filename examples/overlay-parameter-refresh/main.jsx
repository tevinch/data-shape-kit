import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import './style.css';

ModuleRegistry.registerModules([AllCommunityModule]);
const rows = [{ name: 'Apricot', quantity: 12 }, { name: 'Pear', quantity: 7 }];
const columns = [{ field: 'name', filter: 'agTextColumnFilter' }, { field: 'quantity' }];

function CustomOverlay({ label, showAction, onAction, overlayType }) {
  const [note, setNote] = useState('');
  return <section className="custom-overlay" data-type={overlayType}>
    <strong data-label>{label}</strong>
    <span data-state>{overlayType}</span>
    <label>Unsaved note <input data-note value={note} onChange={event => setNote(event.target.value)} /></label>
    {showAction && <button data-action onClick={onAction}>
      {overlayType === 'noMatchingRows' ? 'Clear filters' : 'Try again'}
    </button>}
  </section>;
}

// Stable component and selector identities: parameter changes do not remount the overlay.
function selectOverlay({ overlayType }) {
  if (overlayType === 'noRows' || overlayType === 'noMatchingRows') return { component: CustomOverlay };
  return undefined;
}

function App() {
  const mode = new URLSearchParams(location.search).get('mode') || 'selector';
  const grid = useRef(null);
  const [rowData, setRowData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(1);
  const [showAction, setShowAction] = useState(false);
  const [callbackRevision, setCallbackRevision] = useState(0);
  const params = {
    label: `Revision ${revision}`,
    showAction,
    onAction() {
      setCallbackRevision(revision);
      grid.current.api.setFilterModel(null);
    },
  };
  const overlayOptions = mode === 'legacy'
    ? { noRowsOverlayComponent: CustomOverlay, noRowsOverlayComponentParams: params }
    : mode === 'direct'
      ? { overlayComponent: CustomOverlay, overlayComponentParams: params }
      : { overlayComponentSelector: selectOverlay, overlayComponentParams: params };
  return <main>
    <h1>Overlay parameter refresh</h1>
    <p>Mode: <b>{mode}</b>. Change parameters while the grid overlay is visible.</p>
    <nav><a href="?mode=selector">Selector</a> · <a href="?mode=direct">Direct</a> · <a href="?mode=legacy">Legacy comparison</a></nav>
    <div className="controls">
      <button id="update" onClick={() => setRevision(value => value + 1)}>Update parameters</button>
      <button id="action-toggle" onClick={() => setShowAction(value => !value)}>Toggle overlay action</button>
      <button id="load" onClick={() => setRowData(rows)}>Load rows</button>
      <button id="empty" onClick={() => setRowData([])}>Empty rows</button>
      <button id="filter" onClick={() => grid.current.api.setFilterModel({ name: { filterType: 'text', type: 'equals', filter: 'Plum' } })}>Filter to Plum</button>
      <button id="loading" onClick={() => setLoading(value => !value)}>Toggle loading</button>
    </div>
    <p>Requested: <span id="requested">{revision}</span> · Last action callback: <span id="callback">{callbackRevision}</span></p>
    <div className="grid">
      <AgGridReact ref={grid} theme={themeQuartz} rowData={rowData} columnDefs={columns}
        defaultColDef={{ flex: 1, cellDataType: false }} loading={loading}
        onGridReady={({ api }) => {
          // Read-only observations for the browser check; all actions use visible controls.
          window.readGrid = () => {
            const all = []; const displayed = [];
            api.forEachNode(node => all.push(node.data));
            api.forEachNodeAfterFilterAndSort(node => displayed.push(node.data));
            return { all, displayed, filters: api.getFilterModel(), loading: api.getGridOption('loading') };
          };
        }} {...overlayOptions} />
    </div>
  </main>;
}
createRoot(document.getElementById('root')).render(<App />);
