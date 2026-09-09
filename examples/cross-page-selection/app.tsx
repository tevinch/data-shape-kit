import {useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {
  createColumnHelper,
  rowPaginationFeature,
  rowSelectionFeature,
  tableFeatures,
  useTable,
  type RowSelectionState,
} from '@tanstack/react-table';

import {
  applyPageUpdate,
  emptySelection,
  pageSelection,
  selectAllMatching,
  selectedCount,
  type Selection,
} from './selection.mjs';
import type {
  Category,
  DemoRow,
  ErrorResponse,
  PageResponse,
  PreviewResponse,
  SortDirection,
} from './types';
import './app.css';

const PAGE_SIZE = 5;
const EMPTY_ROWS: DemoRow[] = [];
const features = tableFeatures({rowSelectionFeature, rowPaginationFeature});

function SelectionCheckbox({
  checked,
  disabled = false,
  label,
  mixed = false,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  mixed?: boolean;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
}) {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (input.current) input.current.indeterminate = mixed;
  }, [mixed]);

  return (
    <input
      ref={input}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onChange={onChange}
    />
  );
}

const columnHelper = createColumnHelper<typeof features, DemoRow>();
const columns = columnHelper.columns([
  columnHelper.display({
    id: 'select',
    header: ({table}) => {
      const all = table.getIsAllPageRowsSelected();
      const some = table.getIsSomePageRowsSelected();
      const hasSelectableRows = table.getRowModel().rows.some((row) => row.getCanSelect());
      return (
        <SelectionCheckbox
          checked={all}
          disabled={!hasSelectableRows}
          mixed={some && !all}
          label="Select all eligible rows on this page"
          onChange={table.getToggleAllPageRowsSelectedHandler()}
        />
      );
    },
    cell: ({row}) => (
      <SelectionCheckbox
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        label={`Select ${row.original.title}`}
        onChange={row.getToggleSelectedHandler()}
      />
    ),
  }),
  columnHelper.accessor('title', {header: 'Resource'}),
  columnHelper.accessor('category', {header: 'Category'}),
  columnHelper.display({
    id: 'availability',
    header: 'Selection',
    cell: ({row}) => row.original.selectable ? 'Eligible' : 'Disabled',
  }),
]);

async function responseJson<T>(response: Response): Promise<T> {
  const value = await response.json() as T | ErrorResponse;
  if (!response.ok) {
    const message = typeof value === 'object' && value !== null && 'error' in value
      ? String(value.error)
      : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return value as T;
}

function App() {
  const [category, setCategory] = useState<Category>('all');
  const [sort, setSort] = useState<SortDirection>('asc');
  const [pageIndex, setPageIndex] = useState(0);
  const [page, setPage] = useState<PageResponse | null>(null);
  const [selection, setSelection] = useState<Selection>(() => emptySelection('catalog-v1:all'));
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetNotice, setResetNotice] = useState<string | null>(null);
  const pageAbort = useRef<AbortController | null>(null);
  const previewAbort = useRef<AbortController | null>(null);
  const previewRequest = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    pageAbort.current?.abort();
    pageAbort.current = controller;
    setLoading(true);
    setError(null);

    const query = new URLSearchParams({
      category,
      sort,
      pageIndex: String(pageIndex),
    });
    void fetch(`./api/page?${query}`, {signal: controller.signal})
      .then((response) => responseJson<PageResponse>(response))
      .then((nextPage) => {
        if (!controller.signal.aborted) setPage(nextPage);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setPage(null);
          setError(reason instanceof Error ? reason.message : 'Unable to load the page');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [category, pageIndex, sort]);

  useEffect(() => () => previewAbort.current?.abort(), []);

  const eligiblePageIds = useMemo(
    () => page?.rows.filter((row) => row.selectable).map((row) => row.id) ?? [],
    [page],
  );
  const rowSelection = useMemo<RowSelectionState>(() => {
    if (!page || selection.scope !== page.scope) return Object.create(null) as RowSelectionState;
    return pageSelection(selection, {scope: page.scope, ids: eligiblePageIds});
  }, [eligiblePageIds, page, selection]);

  const table = useTable({
    features,
    columns,
    data: page?.rows ?? EMPTY_ROWS,
    getRowId: (row) => row.id,
    enableRowSelection: (row) => row.original.selectable,
    enableMultiRowSelection: true,
    enableSubRowSelection: false,
    enableRowRangeSelection: false,
    manualPagination: true,
    rowCount: page?.rowCount ?? 0,
    state: {
      pagination: {pageIndex, pageSize: PAGE_SIZE},
      rowSelection,
    },
    onPaginationChange: (updater) => {
      pageAbort.current?.abort();
      setPage(null);
      setLoading(true);
      setPageIndex((previous) => {
        const current = {pageIndex: previous, pageSize: PAGE_SIZE};
        return (typeof updater === 'function' ? updater(current) : updater).pageIndex;
      });
    },
    onRowSelectionChange: (updater) => {
      setPreview(null);
      setSelection((previous) => {
        if (!page || previous.scope !== page.scope) return previous;
        return applyPageUpdate(previous, {scope: page.scope, ids: eligiblePageIds}, updater);
      });
    },
  });

  const changeCategory = (nextCategory: Category) => {
    pageAbort.current?.abort();
    previewAbort.current?.abort();
    previewRequest.current += 1;
    setCategory(nextCategory);
    setPageIndex(0);
    setPage(null);
    setPreview(null);
    setPreviewLoading(false);
    setLoading(true);
    setError(null);
    setSelection(emptySelection(`catalog-v1:${nextCategory}`));
    setResetNotice(`Selection reset for ${nextCategory}.`);
  };

  const previewSelection = async () => {
    previewAbort.current?.abort();
    const controller = new AbortController();
    const requestId = ++previewRequest.current;
    previewAbort.current = controller;
    setPreviewLoading(true);
    setError(null);
    try {
      const response = await fetch('./api/preview', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify(selection),
        signal: controller.signal,
      });
      const result = await responseJson<PreviewResponse>(response);
      if (requestId === previewRequest.current && result.scope === selection.scope) {
        setPreview(result);
      }
    } catch (reason) {
      if (!controller.signal.aborted && requestId === previewRequest.current) {
        setError(reason instanceof Error ? reason.message : 'Unable to preview selection');
      }
    } finally {
      if (requestId === previewRequest.current) setPreviewLoading(false);
    }
  };

  const currentSelectedCount = page && selection.scope === page.scope
    ? selectedCount(selection, page.eligibleCount)
    : 0;
  const displayedPage = page ? page.pageIndex + 1 : pageIndex + 1;
  const pageCount = table.getPageCount();

  return (
    <div className="shell">
      <header className="hero">
        <p className="eyebrow">TanStack Table v9 · server pagination</p>
        <h1>Cross-page row selection</h1>
        <p>
          Keep one compact selection descriptor while the browser receives only the current page.
        </p>
      </header>

      <main>
        <section className="panel controls" aria-label="Catalog controls">
          <label>
            Category
            <select
              value={category}
              onChange={(event) => changeCategory(event.target.value as Category)}
            >
              <option value="all">All</option>
              <option value="Guides">Guides</option>
              <option value="Utilities">Utilities</option>
              <option value="Empty">Empty</option>
            </select>
          </label>
          <label>
            Sort
            <select
              value={sort}
              onChange={(event) => {
                pageAbort.current?.abort();
                setSort(event.target.value as SortDirection);
                setPageIndex(0);
                setPage(null);
                setLoading(true);
              }}
            >
              <option value="asc">ID ascending</option>
              <option value="desc">ID descending</option>
            </select>
          </label>
          <div className="counts" aria-live="polite">
            <strong>{currentSelectedCount}</strong> selected · {page?.eligibleCount ?? 0} eligible ·{' '}
            {page?.rowCount ?? 0} rows
          </div>
        </section>

        {resetNotice && <p className="notice" role="status">{resetNotice}</p>}
        {error && <p className="error" role="alert">{error}</p>}

        <section className="panel table-panel" aria-busy={loading}>
          <div className="table-actions">
            <button
              type="button"
              disabled={!page || page.eligibleCount === 0 || selection.mode === 'exclude' && selection.ids.length === 0}
              onClick={() => {
                if (!page) return;
                setSelection(selectAllMatching(page.scope));
                setPreview(null);
              }}
            >
              Select all {page?.eligibleCount ?? 0} eligible matches
            </button>
            <button
              type="button"
              disabled={!page || currentSelectedCount === 0}
              onClick={() => {
                if (!page) return;
                setSelection(emptySelection(page.scope));
                setPreview(null);
              }}
            >
              Clear selection
            </button>
            <button type="button" disabled={!page || previewLoading} onClick={previewSelection}>
              {previewLoading ? 'Loading preview…' : 'Preview selection'}
            </button>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id}>
                    {group.headers.map((header) => (
                      <th key={header.id}>
                        {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className={!row.original.selectable ? 'disabled-row' : undefined}>
                    {row.getAllCells().map((cell) => (
                      <td key={cell.id}><table.FlexRender cell={cell} /></td>
                    ))}
                  </tr>
                ))}
                {!loading && table.getRowModel().rows.length === 0 && (
                  <tr><td colSpan={4} className="empty">No rows in this category.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {loading && <p className="loading" role="status">Loading page…</p>}

          <nav className="pagination" aria-label="Pagination">
            <button type="button" onClick={() => table.previousPage()} disabled={loading || !table.getCanPreviousPage()}>
              Previous
            </button>
            <span>Page {displayedPage} of {Math.max(pageCount, 1)} · {page?.rows.length ?? 0} on this page</span>
            <button type="button" onClick={() => table.nextPage()} disabled={loading || !table.getCanNextPage()}>
              Next
            </button>
          </nav>
        </section>

        <section className="details-grid">
          <article className="panel">
            <h2>Compact descriptor</h2>
            <code>{JSON.stringify(selection)}</code>
            <p>Include stores selected IDs. Exclude stores exceptions to all eligible matches.</p>
          </article>
          <article className="panel" aria-live="polite">
            <h2>Server preview</h2>
            {preview ? (
              <>
                <p><strong>{preview.count}</strong> resolved matches; showing up to five.</p>
                <ul>{preview.rows.map((row) => <li key={row.id}>{row.title}</li>)}</ul>
              </>
            ) : <p>Preview resolves the descriptor against server-owned eligible rows.</p>}
          </article>
        </section>
      </main>

      <footer>
        <p>Buy me a coffee, if this helped</p>
        <dl>
          <div><dt>USDC / SOL · Solana</dt><dd>9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy</dd></div>
          <div><dt>USDC / ETH · Base</dt><dd>0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA</dd></div>
          <div><dt>USDT · BNB Smart Chain (BEP20)</dt><dd>0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA</dd></div>
        </dl>
        <p className="fine-print">
          Synthetic local read-only data · See <a href="./THIRD_PARTY_NOTICES.md">license notices</a> ·{' '}
          <a href="https://github.com/tevinch/data-shape-kit/tree/main/examples/cross-page-selection">public guide</a>
        </p>
      </footer>
    </div>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
createRoot(root).render(<App />);
