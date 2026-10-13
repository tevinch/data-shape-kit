import * as React from 'react';
import { createRoot } from 'react-dom/client';
import {
  createTableHook, tableFeatures, rowSortingFeature, rowPaginationFeature,
  columnFilteringFeature, globalFilteringFeature, createSortedRowModel, createFilteredRowModel,
  createPaginatedRowModel, filterFn_includesString, sortFn_alphanumeric,
} from '@tanstack/react-table';
import { useSelector } from '@tanstack/react-store';

type Item = { id: string; title: string; revision: number };
const features = tableFeatures({
  rowSortingFeature, rowPaginationFeature, columnFilteringFeature, globalFilteringFeature,
  sortedRowModel: createSortedRowModel(), filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filterFns: { includesString: filterFn_includesString },
  sortFns: { alphanumeric: sortFn_alphanumeric },
});
const { useAppTable, useTableContext } = createTableHook({
  features, tableComponents: { Grid: React.memo(Grid), Body: React.memo(Body), Controls },
});
const columns = [{ accessorKey: 'title', header: 'Title', sortFn: 'alphanumeric' as const },
  { accessorKey: 'revision', header: 'Revision' }];
function Body() {
  const table = useTableContext<Item>();
  return <table.Subscribe selector={state => state}>
    {() => <tbody>{table.getRowModel().rows.map(row =>
      <tr key={row.id}>{row.getAllCells().map(cell =>
        <td key={cell.id}><table.FlexRender cell={cell} /></td>)}</tr>)}</tbody>}
  </table.Subscribe>;
}
function Controls() {
  const table = useTableContext<Item>();
  const state = useSelector(table.store, (value) => value);
  return <div>
    <button onClick={() => table.setSorting([{id: 'title', desc: false}])}>Sort ascending</button>
    <button onClick={() => table.setSorting([{id: 'title', desc: true}])}>Sort descending</button>
    <button onClick={() => table.setSorting([])}>Clear sorting</button>
    <label>Filter <input value={state.globalFilter ?? ''} onChange={e => table.setGlobalFilter(e.target.value)}/></label>
    <button onClick={() => table.previousPage()}>Previous</button>
    <button onClick={() => table.nextPage()}>Next</button>
    <span>Page {state.pagination.pageIndex + 1}</span>
  </div>;
}
function Grid() {
  const table = useTableContext<Item>();
  return <><table.Controls/><table><thead><tr><th>Title</th><th>Revision</th></tr></thead><table.Body/></table></>;
}
const Spacer = React.memo(function Spacer({ children }: { children: React.ReactNode }) {
  return <div className="nested">{children}</div>;
});
function makeData(revision: number): Item[] {
  const items = ['Alpha','Beta','Gamma','Delta','Epsilon','Zeta'].map(title => ({id:title,title,revision}));
  const offset=revision % items.length;
  return [...items.slice(offset), ...items.slice(0,offset)];
}
function App() {
  const [data, setData] = React.useState(() => makeData(0));
  const [running, setRunning] = React.useState(false);
  const [autoResetPageIndex, setAutoReset] = React.useState(false);
  const update = React.useCallback(() => setData(old => makeData((old[0]?.revision ?? 0)+1)), []);
  React.useEffect(() => {
    if (!running) return;
    const timer = setInterval(update, 2000);
    return () => clearInterval(timer);
  },[running,update]);
  const table = useAppTable({ columns, data, getRowId: row => row.id,
    autoResetPageIndex, initialState: { pagination: {pageIndex:0,pageSize:3} } }, () => null);
  return <main><h1>External table data</h1>
    <button onClick={update}>Update data</button>
    <button onClick={() => setRunning(!running)}>{running ? 'Stop updates' : 'Start updates'}</button>
    <button onClick={() => setData([])}>Empty data</button>
    <label><input type="checkbox" checked={autoResetPageIndex} onChange={e => setAutoReset(e.target.checked)}/>Reset page on data change</label>
    <p>Source revision: <output id="source-revision">{data[0]?.revision ?? 'empty'}</output></p>
    <pre id="source-data">{JSON.stringify(data)}</pre>
      <table.AppTable><Spacer><table.Grid/></Spacer></table.AppTable>
  </main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
