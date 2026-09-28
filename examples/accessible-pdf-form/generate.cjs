const fs = require('node:fs');
const path = require('node:path');

if (!process.argv[2]) {
  throw new Error('Usage: node generate.cjs /path/to/built/pdfkit [request-form.pdf]');
}
const checkout = path.resolve(process.argv[2]);
const output = path.resolve(process.argv[3] || 'request-form.pdf');
const { PDFDocument } = require(path.join(checkout, 'js/pdfkit.js'));

const doc = new PDFDocument({
  pdfVersion: '1.7', tagged: true, subset: 'PDF/UA', lang: 'en-US',
  displayTitle: true, info: { Title: 'Accessible request form' },
  autoFirstPage: false,
});
const chunks = [];
doc.on('data', chunk => chunks.push(chunk));
doc.on('error', error => { throw error; });
doc.on('end', () => {
  fs.writeFileSync(output, Buffer.concat(chunks));
  console.log(`Written ${output}`);
});

doc.addPage();
doc.font('Helvetica');
doc.initForm();
const bodyFont = path.join(checkout, 'tests/fonts/Roboto-Regular.ttf');
doc.font(bodyFont);
const root = doc.struct('Document');
doc.addStructure(root);
root.add(doc.struct('H1', () => doc.fontSize(20).text('Accessible request form', 60, 60)));
root.add(doc.struct('P', () => doc.fontSize(11).text('Keep this reference text when updating the two fields below.', 60, 100)));

for (const [index, field] of [
  ['requestNumber', 'Request number', 'REQ-001'],
  ['department', 'Department', 'Support'],
].entries()) {
  if (index > 0) {
    doc.addPage();
    doc.font(bodyFont);
    root.add(doc.struct('H2', () => doc.fontSize(20).text('Request details', 60, 60)));
    root.add(doc.struct('P', () => doc.fontSize(11).text('Keep this page when updating the department field.', 60, 100)));
  }
  const [name, label, value] = field;
  root.add(doc.struct('P', () => doc.fontSize(11).text(label, 60, 160)));
  const structure = doc.struct('Form', { title: label });
  root.add(structure);
  doc.markContent('Artifact', { type: 'Layout' });
  doc.lineWidth(0.5).rect(60, 180, 240, 28).stroke();
  doc.endMarkedContent();
  doc.font('Helvetica');
  doc.formText(name, 64, 182, 232, 24, {
    alternateName: label, structParent: structure, fontSize: 11,
    value, defaultValue: value,
  });
}
// Deliberately finalize after creating both pages.
root.end();
doc.end();
