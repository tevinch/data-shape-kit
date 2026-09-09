import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

import {
  constructTable,
  rowPaginationFeature,
  rowSelectionFeature,
  tableFeatures,
} from '@tanstack/react-table';
import {storeReactivityBindings} from '@tanstack/table-core/store-reactivity-bindings';

import {
  applyPageUpdate,
  emptySelection,
  isSelected,
  pageSelection,
  selectAllMatching,
} from './selection.mjs';

const features = tableFeatures({
  coreReactivityFeature: storeReactivityBindings(),
  rowSelectionFeature,
  rowPaginationFeature,
});

function row(id, selectable = true) {
  return {id, title: id, category: 'Utilities', selectable};
}

function createIntegratedTable(initialSelection, data, rowCount = data.length) {
  const page = {
    scope: initialSelection.scope,
    ids: data.filter((item) => item.selectable).map((item) => item.id),
  };
  let selection = initialSelection;
  let rowSelection = pageSelection(selection, page);
  let lastUpdater;
  let table;

  const syncSelection = (updater) => {
    lastUpdater = updater;
    selection = applyPageUpdate(selection, page, updater);
    rowSelection = pageSelection(selection, page);
    table.options = {
      ...table.options,
      state: {...table.options.state, rowSelection},
    };
  };

  table = constructTable({
    features,
    columns: [],
    data,
    getRowId: (item) => item.id,
    enableRowSelection: (currentRow) => currentRow.original.selectable,
    enableMultiRowSelection: true,
    enableSubRowSelection: false,
    enableRowRangeSelection: false,
    manualPagination: true,
    rowCount,
    state: {
      pagination: {pageIndex: 0, pageSize: 5},
      rowSelection,
    },
    onPaginationChange: () => {},
    onRowSelectionChange: syncSelection,
  });

  return {
    table,
    getSelection: () => selection,
    lastUpdaterWasFunction: () => typeof lastUpdater === 'function',
  };
}

test('actual TanStack row toggles use function updaters and preserve off-page IDs', () => {
  const firstPage = createIntegratedTable(
    emptySelection('catalog-v1:all'),
    [row('item-001'), row('item-002')],
    23,
  );
  firstPage.table.getRow('item-001').toggleSelected(true);
  assert.equal(firstPage.lastUpdaterWasFunction(), true);
  assert.deepEqual(firstPage.getSelection().ids, ['item-001']);
  assert.deepEqual(firstPage.table.getSelectedRowIds(), ['item-001']);
  assert.equal(Object.getPrototypeOf(firstPage.table.atoms.rowSelection.get()), null);
  assert.equal(Object.hasOwn(firstPage.table.atoms.rowSelection.get(), 'item-001'), true);
  assert.equal(firstPage.table.atoms.rowSelection.get()['item-001'], true);
  assert.equal(firstPage.table.getRow('item-001').getIsSelected(), true);

  const secondPage = createIntegratedTable(
    firstPage.getSelection(),
    [row('item-006'), row('item-007', false), row('item-008')],
    23,
  );
  secondPage.table.getRow('item-008').toggleSelected(true);
  assert.deepEqual(secondPage.getSelection().ids, ['item-001', 'item-008']);
  assert.deepEqual(secondPage.table.getSelectedRowIds(), ['item-008']);
  assert.equal(isSelected(secondPage.getSelection(), 'item-001'), true);
});

test('all-matching mode selects unseen rows and stores page exceptions', () => {
  const integrated = createIntegratedTable(
    selectAllMatching('catalog-v1:all'),
    [row('item-001'), row('item-002'), row('item-003')],
    23,
  );

  assert.equal(integrated.table.getIsAllPageRowsSelected(), true);
  assert.deepEqual(integrated.table.getSelectedRowIds(), [
    'item-001', 'item-002', 'item-003',
  ]);
  assert.equal(isSelected(integrated.getSelection(), 'item-020'), true);

  integrated.table.getRow('item-002').toggleSelected(false);
  assert.deepEqual(integrated.getSelection(), {
    scope: 'catalog-v1:all',
    mode: 'exclude',
    ids: ['item-002'],
  });
  assert.equal(integrated.table.getRow('item-002').getIsSelected(), false);
  assert.equal(isSelected(integrated.getSelection(), 'item-020'), true);

  const laterPage = createIntegratedTable(
    integrated.getSelection(),
    [row('item-006'), row('item-007', false), row('item-008')],
    23,
  );
  laterPage.table.getRow('item-008').toggleSelected(false);
  assert.deepEqual(laterPage.getSelection().ids, ['item-002', 'item-008']);
  assert.equal(isSelected(laterPage.getSelection(), 'item-002'), false);
  assert.deepEqual(laterPage.table.getSelectedRowIds(), ['item-006']);
});

test('disabled rows stay outside maps and page-header state', () => {
  const integrated = createIntegratedTable(
    emptySelection('catalog-v1:all'),
    [row('item-006'), row('item-007', false), row('item-008')],
    23,
  );

  assert.equal(integrated.table.getRow('item-007').getCanSelect(), false);
  integrated.table.toggleAllPageRowsSelected(true);
  assert.deepEqual(integrated.getSelection().ids, ['item-006', 'item-008']);
  assert.deepEqual(integrated.table.getSelectedRowIds(), ['item-006', 'item-008']);
  assert.equal(integrated.table.getIsAllPageRowsSelected(), true);
});

test('page header reports mixed state from the current eligible page', () => {
  const seeded = applyPageUpdate(
    emptySelection('catalog-v1:all'),
    {scope: 'catalog-v1:all', ids: ['item-001']},
    {['item-001']: true},
  );
  const integrated = createIntegratedTable(
    seeded,
    [row('item-001'), row('item-002'), row('item-003')],
    23,
  );

  assert.equal(integrated.table.getIsAllPageRowsSelected(), false);
  assert.equal(integrated.table.getIsSomePageRowsSelected(), true);
  integrated.table.toggleAllPageRowsSelected(true);
  assert.equal(integrated.table.getIsAllPageRowsSelected(), true);
  assert.equal(integrated.table.getIsSomePageRowsSelected(), true);
  assert.equal(
    integrated.table.getIsSomePageRowsSelected()
      && !integrated.table.getIsAllPageRowsSelected(),
    false,
  );
});

test('browser integration does not import the complete synthetic dataset', async () => {
  const source = await readFile(new URL('./app.tsx', import.meta.url), 'utf8');
  assert.equal(source.includes('demo-data'), false);
});
