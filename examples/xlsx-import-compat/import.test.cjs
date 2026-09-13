// Generated fixtures contain no user workbook data and make no network requests.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');

const originalName = 'Existing Partner Full menu Expansion';
const truncatedName = originalName.slice(0, 31);
const collidingName = `${truncatedName} other`;
const prefix = ' leading 空白 & ';
const plainText = '  untouched & plain  ';
const hyperlinkTarget = 'https://example.com/xlsx-import-compat';
const styled = {font: {underline: true, color: {theme: 10}}, text: '链接 text'};
const tail = {font: {bold: true}, text: ' tail '};

const xmlText = text => text
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

async function withExpectedLongNameWarnings(operation) {
  const warn = console.warn;
  console.warn = (...parts) => {
    const message = parts.join(' ');
    if (!message.includes('exceeds 31 chars. This will be truncated')) warn(...parts);
  };
  try {
    return await operation();
  } finally {
    console.warn = warn;
  }
}

async function fixture({
  kind = 'shared',
  leading = prefix,
  longName = false,
  collision = false,
  hyperlink = false,
} = {}) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Source');
  const richText = {richText: [styled, tail]};
  sheet.getCell('A1').value = hyperlink
    ? {text: richText, hyperlink: hyperlinkTarget}
    : richText;
  sheet.getCell('B1').value = plainText;
  sheet.getCell('C1').value = 42;
  sheet.getCell('D1').value = {formula: 'C1*2', result: 84};
  if (collision) workbook.addWorksheet('Second');

  const zip = await JSZip.loadAsync(await workbook.xlsx.writeBuffer());
  const sharedFile = zip.file('xl/sharedStrings.xml');
  assert(sharedFile, 'fixture must contain shared strings');
  const shared = await sharedFile.async('string');
  const itemMatch = shared.match(/<si>([\s\S]*?<r>[\s\S]*?)<\/si>/);
  assert(itemMatch, 'fixture must contain a rich shared string');
  const item = itemMatch[1];
  const mixed = `<t xml:space="preserve">${xmlText(leading)}</t>${item}`;

  if (kind === 'shared') {
    const updated = shared.replace(`<si>${item}</si>`, `<si>${mixed}</si>`);
    assert.notEqual(updated, shared, 'fixture must replace the shared string');
    zip.file('xl/sharedStrings.xml', updated);
  } else if (kind === 'inline') {
    const sheetFile = zip.file('xl/worksheets/sheet1.xml');
    assert(sheetFile, 'fixture must contain sheet1.xml');
    const sheetXml = await sheetFile.async('string');
    const updated = sheetXml.replace(
      /<c r="A1"[^>]*>[\s\S]*?<\/c>/,
      `<c r="A1" t="inlineStr"><is>${mixed}</is></c>`,
    );
    assert.notEqual(updated, sheetXml, 'fixture must replace A1');
    zip.file('xl/worksheets/sheet1.xml', updated);
  }

  if (longName || collision) {
    const workbookFile = zip.file('xl/workbook.xml');
    assert(workbookFile, 'fixture must contain workbook.xml');
    let names = await workbookFile.async('string');
    names = names.replace(
      'name="Source"',
      `name="${collision ? truncatedName : originalName}"`,
    );
    if (collision) names = names.replace('name="Second"', `name="${collidingName}"`);
    zip.file('xl/workbook.xml', names);
  }

  return zip.generateAsync({type: 'nodebuffer'});
}

function expectedRuns(leading) {
  return leading ? [{text: leading}, styled, tail] : [styled, tail];
}

function assertOrdinaryCells(sheet) {
  assert.equal(sheet.getCell('B1').value, plainText);
  assert.equal(sheet.getCell('C1').value, 42);
  assert.deepEqual(sheet.getCell('D1').value, {formula: 'C1*2', result: 84});
}

function assertRichCell(cell, leading, hyperlink = false) {
  const runs = expectedRuns(leading);
  if (hyperlink) {
    assert.equal(cell.value.hyperlink, hyperlinkTarget);
    assert.deepEqual(cell.value.text, {richText: runs});
  } else {
    assert.deepEqual(cell.value, {richText: runs});
    assert.equal(cell.text, `${leading}${styled.text}${tail.text}`);
  }
}

async function verifyImport(options) {
  const load = () => new ExcelJS.Workbook().xlsx.load(fixture(options));
  const workbook = options.longName
    ? await withExpectedLongNameWarnings(load)
    : await load();
  const sheet = workbook.worksheets[0];
  assert.equal(sheet.name, options.longName ? truncatedName : 'Source');
  assertRichCell(sheet.getCell('A1'), options.leading, options.hyperlink);
  assertOrdinaryCells(sheet);

  const reload = () => new ExcelJS.Workbook().xlsx.load(workbook.xlsx.writeBuffer());
  const roundtrip = options.longName
    ? await withExpectedLongNameWarnings(reload)
    : await reload();
  const roundtripSheet = roundtrip.worksheets[0];
  assertRichCell(roundtripSheet.getCell('A1'), options.leading, options.hyperlink);
  assertOrdinaryCells(roundtripSheet);
  return workbook;
}

// These six tests catch the missing string-to-rich-text promotion in the
// published shared-string and inline-string parsers before the first rich run.
for (const kind of ['shared', 'inline']) {
  for (const leading of ['', prefix, '0']) {
    test(`REGRESSION [${kind}-mixed] ${kind} string keeps leading ${JSON.stringify(leading)} and rich-text formatting through XLSX load/write`, async () => {
      await verifyImport({kind, leading});
    });
  }
}

// This catches both a mixed shared-string import and the worksheet setter
// treating the current, already-created worksheet as a duplicate.
test('REGRESSION [combined] the combined long-name and mixed-string workbook imports', async () => {
  await verifyImport({kind: 'shared', leading: prefix, longName: true});
});

// This isolates the current-worksheet duplicate error during XLSX import.
test('REGRESSION [long-name] a long worksheet name imports without colliding with itself', async () => {
  await verifyImport({kind: 'rich-only', leading: '', longName: true});
});

// This control protects the real collision behavior: the first name is already
// 31 characters, while the distinct second name becomes equal only on truncation.
test('CONTROL a genuine collision after truncation still rejects', async () => {
  await withExpectedLongNameWarnings(() => assert.rejects(
    new ExcelJS.Workbook().xlsx.load(fixture({
      kind: 'rich-only',
      leading: '',
      collision: true,
    })),
    /Worksheet name already exists/,
  ));
});

// This control catches collateral damage to rich text, plain whitespace,
// numbers and same-sheet cached formulas.
test('CONTROL ordinary rich text and neighbouring scalar/formula cells remain intact', async () => {
  await verifyImport({kind: 'rich-only', leading: ''});
});

// This control catches a weakened case-insensitive collision check.
test('CONTROL worksheet names still reject case-insensitive duplicates', () => {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Summary');
  assert.throws(() => workbook.addWorksheet('sUMMARY'), /Worksheet name already exists/);
});

// These tests catch the same two parser failures when the mixed rich string is
// attached to a real XLSX hyperlink relationship.
for (const kind of ['shared', 'inline']) {
  test(`REGRESSION [${kind}-hyperlink] ${kind} hyperlink preserves its target and nested mixed rich text`, async () => {
    await verifyImport({kind, leading: prefix, hyperlink: true});
  });
}

// This control catches collateral damage to ordinary string hyperlinks.
test('CONTROL an ordinary hyperlink keeps its text and relationship target', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Links');
  sheet.getCell('A1').value = {text: 'Example documentation', hyperlink: hyperlinkTarget};
  const loaded = await new ExcelJS.Workbook().xlsx.load(await workbook.xlsx.writeBuffer());
  assert.deepEqual(loaded.worksheets[0].getCell('A1').value, {
    text: 'Example documentation',
    hyperlink: hyperlinkTarget,
  });
  const roundtrip = await new ExcelJS.Workbook().xlsx.load(await loaded.xlsx.writeBuffer());
  assert.deepEqual(roundtrip.worksheets[0].getCell('A1').value, {
    text: 'Example documentation',
    hyperlink: hyperlinkTarget,
  });
});

async function stressFixture() {
  const workbook = new ExcelJS.Workbook();
  const sheets = Array.from({length: 12}, (_, index) => workbook.addWorksheet(`Stress ${index + 1}`));
  const expectations = [];
  for (let index = 0; index < 671; index += 1) {
    const sheetIndex = index % sheets.length;
    const row = Math.floor(index / sheets.length) + 1;
    const address = `A${row}`;
    const runs = [
      {font: {italic: true}, text: `item-${index}-链接`},
      {font: {bold: true}, text: ` tail-${index} `},
    ];
    sheets[sheetIndex].getCell(address).value = {richText: runs};
    expectations.push({sheetIndex, address, leading: ` lead-${index} & 空白 `, runs});
  }

  const zip = await JSZip.loadAsync(await workbook.xlsx.writeBuffer());
  const sharedFile = zip.file('xl/sharedStrings.xml');
  assert(sharedFile, 'stress fixture must contain shared strings');
  const shared = await sharedFile.async('string');
  const sharedOrder = [...expectations].sort((left, right) => (
    left.sheetIndex - right.sheetIndex
      || Number.parseInt(left.address.slice(1), 10) - Number.parseInt(right.address.slice(1), 10)
  ));
  let itemIndex = 0;
  const mixed = shared.replace(/<si>(?=<r>)/g, () => {
    const expectation = sharedOrder[itemIndex];
    assert(expectation, 'stress fixture has more shared strings than expected');
    itemIndex += 1;
    return `<si><t xml:space="preserve">${xmlText(expectation.leading)}</t>`;
  });
  assert.equal(itemIndex, 671, 'stress fixture must contain 671 distinct mixed strings');
  zip.file('xl/sharedStrings.xml', mixed);

  const workbookFile = zip.file('xl/workbook.xml');
  assert(workbookFile, 'stress fixture must contain workbook.xml');
  const workbookXml = await workbookFile.async('string');
  const renamed = workbookXml.replace('name="Stress 1"', `name="${originalName}"`);
  assert.notEqual(renamed, workbookXml, 'stress fixture must add a long worksheet name');
  zip.file('xl/workbook.xml', renamed);

  return {
    buffer: await zip.generateAsync({type: 'nodebuffer'}),
    expectations,
  };
}

function assertStressWorkbook(workbook, expectations) {
  assert.equal(workbook.worksheets.length, 12);
  assert.equal(workbook.worksheets[0].name, truncatedName);
  for (const {sheetIndex, address, leading, runs} of expectations) {
    assert.deepEqual(
      workbook.worksheets[sheetIndex].getCell(address).value,
      {richText: [{text: leading}, ...runs]},
      `mixed rich text at sheet ${sheetIndex + 1} ${address}`,
    );
  }
}

// This catches both parser and long-name regressions at realistic scale while
// proving that the strings are distinct rather than repeated references.
test('REGRESSION [stress] 12 sheets and 671 distinct mixed strings survive load/write', async () => {
  const {buffer, expectations} = await stressFixture();
  const loaded = await withExpectedLongNameWarnings(
    () => new ExcelJS.Workbook().xlsx.load(buffer),
  );
  assertStressWorkbook(loaded, expectations);
  const roundtrip = await withExpectedLongNameWarnings(
    () => new ExcelJS.Workbook().xlsx.load(loaded.xlsx.writeBuffer()),
  );
  assertStressWorkbook(roundtrip, expectations);
});
