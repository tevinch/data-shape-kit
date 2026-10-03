export const rows = Array.from({length: 24}, (_, i) => ({
  __row__: i,
  date: new Date(Date.UTC(2024, i, 1)).toISOString(),
  mKPI: 100 + i,
}));

export function checkValues(actual, input, sortField) {
  if (actual.length !== input.length) throw new Error('Output row count changed');
  const ordered = sortField
    ? [...input].sort((a, b) => sortField === 'date'
      ? Date.parse(b.date) - Date.parse(a.date) : b[sortField] - a[sortField])
    : input;
  const byKey = new Map(actual.map(d => [d.__row__, d]));
  for (let i = 0; i < ordered.length; i++) {
    const row = byKey.get(ordered[i].__row__);
    const previous = ordered[i - 12];
    if (!row || row.mKPI !== ordered[i].mKPI
      || +new Date(row.date) !== Date.parse(ordered[i].date)
      || row.mKPI_PY !== (previous?.mKPI ?? null)
      || (row.date_PY == null ? null : +new Date(row.date_PY))
        !== (previous ? Date.parse(previous.date) : null)) {
      throw new Error(`Unexpected input or lag value for row ${ordered[i].__row__}`);
    }
  }
}
