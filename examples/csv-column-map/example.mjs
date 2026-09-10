import assert from 'node:assert/strict';

import { selectCsvColumns } from './papaparse-columns.mjs';

const csv = [
  'Code Set,Unused,Code Name,Code Value',
  '001,remove,Alpha,NA',
  '010,remove,"Beta, Inc.",42',
].join('\r\n');

const selected = selectCsvColumns(csv, {
  'Code Set': 'codeSet',
  'Code Name': 'codeName',
  'Code Value': 'codeValue',
});
const expected = [
  { codeSet: '001', codeName: 'Alpha', codeValue: 'NA' },
  { codeSet: '010', codeName: 'Beta, Inc.', codeValue: '42' },
];

assert.deepEqual(selected, expected);
console.log(JSON.stringify(selected, null, 2));
