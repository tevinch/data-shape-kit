import PDFDocument = require('pdfkit');
import { createWriteStream, existsSync } from 'node:fs';
import { finished } from 'node:stream/promises';

async function main() {
  const font = process.argv[2];
  if (!font || !existsSync(font)) throw new Error('Supply an existing embeddable font file');
  const document = new PDFDocument({
    subset: 'PDF/UA' as PDFKit.Mixins.PDFSubsets,
    tagged: true,
    pdfVersion: '1.7',
    lang: 'en-US',
    displayTitle: true,
    info: {Title: 'PDF UA type example'},
    font,
  });
  const output = createWriteStream('typed-pdfua.pdf');
  document.pipe(output);
  const root = document.struct('Document');
  document.addStructure(root);
  root.add(document.struct('P', {}, () => document.text('The documented PDF UA option is supported by the runtime.')));
  root.end();
  document.end();
  await finished(output);
  console.log('PDF stream finished');
}

main().catch(error => {console.error(error); process.exitCode = 1;});
