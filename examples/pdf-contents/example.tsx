import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderWithContents } from './pdf-contents.js';
import { createSampleDocument, sampleHeadings } from './sample-document.js';

const here = dirname(fileURLToPath(import.meta.url));
const outputDirectory = resolve(here, '../output');
const pdfPath = resolve(outputDirectory, 'contents-demo.pdf');
const jsonPath = resolve(outputDirectory, 'contents-demo.json');

await mkdir(outputDirectory, { recursive: true });

const result = await renderWithContents({
  headings: sampleHeadings,
  buildDocument: createSampleDocument,
});

await Promise.all([
  writeFile(pdfPath, result.buffer),
  writeFile(jsonPath, `${JSON.stringify({
    entries: result.entries,
    pageCount: result.pageCount,
    passes: result.passes,
  }, null, 2)}\n`, 'utf8'),
]);

console.log(`Created contents-demo.pdf (${result.pageCount} pages, ${result.passes} passes)`);
