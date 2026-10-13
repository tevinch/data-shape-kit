import Papa from 'papaparse';

export function exportCsv(rows, options = {}) {
  // Keep an explicitly chosen schema, including Papa's empty-column error.
  if (options.columns != null) return Papa.unparse(rows, options);

  const fields = [...new Set(rows.flatMap(Object.keys))];
  if (fields.length === 0) return '';

  // Fixed-width rows also preserve the shape of completely empty records.
  const records = options.skipEmptyLines === true
    ? rows.filter(row => Object.keys(row).length !== 0)
    : rows;
  const data = records.map(row => fields.map(field => Object.hasOwn(row, field) ? row[field] : undefined));
  return Papa.unparse({ fields, data }, options);
}
