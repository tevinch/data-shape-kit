import { parseClipboard, formatClipboard, toRecords } from './index.mjs';

const input = 'SKU\tNotes\r\n00123\t"First line\nSecond line"\r\n00456\t"Says ""hello"""\r\n';
const rows = parseClipboard(input);
console.log(JSON.stringify(toRecords(rows), null, 2));
console.log('\nTSV for copying back:');
console.log(formatClipboard(rows));
