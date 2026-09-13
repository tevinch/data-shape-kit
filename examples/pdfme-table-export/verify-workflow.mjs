import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { generate } from '@pdfme/generator';
import { table, text } from '@pdfme/schemas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createTemplate } from './fixture.mjs';

const directory = new URL('./.checks/', import.meta.url);
await mkdir(directory, { recursive: true });
const cases = [
  { name: 'overlap', y: 20, rows: [['1', '2', '3']], captions: ['CAPTION'], pages: 1 },
  { name: 'empty', y: 20, rows: [], captions: ['EMPTY'], pages: 1 },
  { name: 'ordinary-short', y: 85, rows: [['1', '2', '3']], captions: ['AFTER'], pages: 1 },
  { name: 'ordinary-long', y: 85, rows: Array.from({ length: 70 }, (_, i) => [`row${String(i).padStart(3, '0')}`, `b${i}`, `c${i}`]), captions: ['AFTER-LONG'], pages: null },
  { name: 'multiple', y: 20, rows: [['1', '2', '3']], captions: ['FIRST', 'SECOND'], pages: 2 },
];
const report = [];
for (const item of cases) {
  const template = createTemplate(item.y);
  const inputs = item.captions.map(caption => ({ tbl: JSON.stringify(item.rows), caption }));
  const original = structuredClone({ template, inputs });
  const bytes = await generate({ template, inputs, plugins: { text, table } });
  assert.deepEqual({ template, inputs }, original, 'Generation must preserve the saved template and inputs');
  await writeFile(new URL(`${item.name}.pdf`, directory), bytes);
  const pdf = await getDocument({ data: bytes.slice(), useSystemFonts: false }).promise;
  try {
    if (item.pages !== null) assert.equal(pdf.numPages, item.pages, item.name);
    else assert.ok(pdf.numPages > 1, 'The long table must actually paginate');
    const pages = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      pages.push(content.items.filter(token => 'str' in token && token.str.trim()));
    }
    const words = pages.flat().map(token => token.str.trim());
    for (const caption of item.captions) assert.equal(words.filter(word => word === caption).length, 1, `${item.name}: ${caption}`);
    for (const row of item.rows) for (const cell of row) {
      assert.equal(words.filter(word => word === cell).length, item.captions.length, `${item.name}: ${cell}`);
    }
    for (const header of ['A', 'B', 'C']) assert.ok(words.filter(word => word === header).length >= item.captions.length);
    if (item.name === 'multiple') {
      assert.ok(pages[0].some(token => token.str === 'FIRST'));
      assert.ok(pages[1].some(token => token.str === 'SECOND'));
    }
    if (item.name === 'ordinary-short') {
      const caption = pages[0].find(token => token.str === 'AFTER');
      const lastCell = pages[0].find(token => token.str === '3');
      const captionY = 297 - caption.transform[5] * 25.4 / 72;
      assert.ok(captionY < 85, 'Ordinary following text must still move upward when a table shrinks');
      assert.ok(caption.transform[5] < lastCell.transform[5], 'Following text must remain below the table');
    }
    if (item.name === 'ordinary-long') {
      const lastRowPage = pages.findIndex(tokens => tokens.some(token => token.str === 'row069'));
      const captionPage = pages.findIndex(tokens => tokens.some(token => token.str === 'AFTER-LONG'));
      assert.ok(captionPage >= lastRowPage, 'Trailing text must not precede the last row');
      if (captionPage === lastRowPage) {
        assert.ok(pages[captionPage].find(token => token.str === 'AFTER-LONG').transform[5] < pages[lastRowPage].find(token => token.str === 'row069').transform[5]);
      }
    }
    report.push({ case: item.name, pages: pdf.numPages, cellsPerInput: item.rows.length * 3, captions: item.captions.length });
  } finally {
    await pdf.destroy();
  }
}
await writeFile(new URL('results.json', directory), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
