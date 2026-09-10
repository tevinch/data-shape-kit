import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { getDocument, version } from 'pdfjs-dist/legacy/build/pdf.mjs';

import { highlightTextItems } from '../highlight-text.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const samplePath = path.resolve(directory, '..', 'sample.pdf');
const standardFontDataUrl = `${path.resolve(directory, '..', 'node_modules/pdfjs-dist/standard_fonts')}${path.sep}`;
const primaryQuery = 'A shared sentence can cross several small fragments without losing a match.';
const literalQuery = 'Invoice A+B (draft) & <review>';

test('maps matches from actual PDF.js text extraction on both sample pages', async () => {
  assert.equal(version, '5.4.296');
  const data = new Uint8Array(await readFile(samplePath));
  const document = await getDocument({ data, standardFontDataUrl }).promise;

  try {
    assert.equal(document.numPages, 2);
    const results = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent({ includeMarkedContent: true });
      const result = highlightTextItems(textContent.items, [primaryQuery, literalQuery]);
      results.push({ items: textContent.items, result });
    }

    assert.deepEqual(results.map(({ result }) => result.matches.filter((match) => match.queryIndex === 0).length), [2, 1]);
    assert.deepEqual(results.map(({ result }) => result.matches.filter((match) => match.queryIndex === 1).length), [1, 1]);

    const firstHit = results[0].result.matches.find((match) => match.queryIndex === 0);
    assert.ok(firstHit);
    const nonemptySegments = firstHit.segments.filter(({ itemIndex }) => {
      const item = results[0].items[itemIndex];
      return 'str' in item && item.str.length > 0;
    });
    assert.ok(nonemptySegments.length > 3);
    assert.deepEqual(nonemptySegments.map(({ itemIndex }) => itemIndex), [6, 7, 8, 9, 10, 11, 12]);
  } finally {
    await document.destroy();
  }
});
