export const fixtures = [
  {
    name: 'Downloaded CSV and leading zeros',
    path: 'sample.csv',
    config: { header: true, skipEmptyLines: true },
    data: [
      { property: 'reportName', value: 'Example', type: 'string' },
      { property: 'identifier', value: '00123', type: 'string' },
    ],
    fields: ['property', 'value', 'type'],
  },
  {
    name: 'Unicode, quoted CRLF and trailing empty cells',
    text: 'code,note,empty\r\n00123,"雪, café\r\nline ""two""",\r\n00007,hello,\r\n',
    config: { header: true, skipEmptyLines: true },
    data: [
      { code: '00123', note: '雪, café\r\nline "two"', empty: '' },
      { code: '00007', note: 'hello', empty: '' },
    ],
    fields: ['code', 'note', 'empty'],
  },
  {
    name: 'Array rows and an explicit semicolon delimiter',
    text: 'id;value\n00123;"a;b"\n',
    config: { delimiter: ';', header: false, skipEmptyLines: true },
    data: [['id', 'value'], ['00123', 'a;b']],
  },
  {
    name: 'UTF-8 BOM and non-ASCII headers',
    text: '\ufeffclé,value\nrésumé,😀\n',
    config: { header: true, skipEmptyLines: true },
    data: [{ clé: 'résumé', value: '😀' }],
    fields: ['clé', 'value'],
  },
];

/** Exact synthetic expectations; do not treat row count alone as success. */
export function resultMatches(result, fixture) {
  return result !== null && typeof result === 'object'
    && Array.isArray(result.errors) && result.errors.length === 0
    && JSON.stringify(result.data) === JSON.stringify(fixture.data)
    && (!fixture.fields || JSON.stringify(result.meta?.fields) === JSON.stringify(fixture.fields));
}
