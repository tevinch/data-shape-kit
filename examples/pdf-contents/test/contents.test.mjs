import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  Document,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer';
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFRef,
  PDFString,
  decodePDFRawStream,
} from 'pdf-lib';
import React from 'react';

import { Contents } from '../dist/Contents.js';
import {
  ContentsConvergenceError,
  renderWithContents,
} from '../dist/pdf-contents.js';
import {
  createSampleDocument,
  sampleHeadings,
} from '../dist/sample-document.js';

const h = React.createElement;

const styles = StyleSheet.create({
  page: { padding: 42, fontFamily: 'Helvetica', fontSize: 10 },
  block: { marginBottom: 8 },
});

const chapterTitlesForTest = [
  'A Map Before the Journey',
  'Signals and Thresholds',
  'Working Notes',
  'A Deliberately Long Heading About Decisions That Must Remain Legible When They Wrap Across More Than One Line',
  'Patterns at the Edge',
  'Working Notes',
  'Small Changes, Wide Effects',
  'The Shape of a Useful Constraint',
  'Observations in Sequence',
  'Intervals and Cadence',
  'A Clearer View of Motion',
  'Closing the Loop',
];

function text(value, props = {}) {
  return h(Text, props, value);
}

function basicDocument(entries, {
  headings = [{ id: 'intro', title: 'Introduction' }],
  includeDestination = true,
  marker = 'Fixture marker',
} = {}) {
  return h(
    Document,
    {
      author: 'Fixture Author',
      creator: 'Fixture Creator',
      title: marker,
    },
    h(Page, { size: 'A4', style: styles.page }, text('Cover')),
    h(
      Page,
      { size: 'A4', style: styles.page },
      h(Contents, { entries }),
      text(marker, { style: styles.block }),
      ...headings.map((heading) => text(heading.title, {
        id: includeDestination ? heading.id : undefined,
        key: heading.id,
      })),
    ),
  );
}

function dereference(context, value) {
  return value instanceof PDFRef ? context.lookup(value) : value;
}

function pdfName(value) {
  return value instanceof PDFName ? value.asString() : undefined;
}

function readNameTree(context, node, output, visited = new Set()) {
  const resolved = dereference(context, node);
  assert.ok(resolved instanceof PDFDict, 'destination name tree node is a dictionary');
  const identity = node instanceof PDFRef ? node.toString() : resolved;
  assert.ok(!visited.has(identity), 'destination name tree is acyclic');
  visited.add(identity);

  const names = dereference(context, resolved.get(PDFName.of('Names')));
  if (names instanceof PDFArray) {
    for (let index = 0; index < names.size(); index += 2) {
      const key = dereference(context, names.get(index));
      assert.ok(key instanceof PDFString, 'destination key is a string');
      output.set(key.decodeText(), names.get(index + 1));
    }
  }

  const kids = dereference(context, resolved.get(PDFName.of('Kids')));
  if (kids instanceof PDFArray) {
    for (let index = 0; index < kids.size(); index += 1) {
      readNameTree(context, kids.get(index), output, visited);
    }
  }
}

async function inspectPdf(buffer) {
  const pdf = await PDFDocument.load(buffer);
  const context = pdf.context;
  const destinations = new Map();
  const names = dereference(context, pdf.catalog.get(PDFName.of('Names')));
  const destTree = names instanceof PDFDict
    ? names.get(PDFName.of('Dests'))
    : undefined;
  if (destTree) readNameTree(context, destTree, destinations);

  const pageByRef = new Map(
    pdf.getPages().map((page, index) => [page.ref.toString(), index + 1]),
  );
  const destinationPages = new Map();
  for (const [id, rawDestination] of destinations) {
    let destination = dereference(context, rawDestination);
    if (destination instanceof PDFDict) {
      destination = dereference(context, destination.get(PDFName.of('D')));
    }
    assert.ok(destination instanceof PDFArray, `destination ${id} is an array`);
    const pageRef = destination.get(0);
    assert.ok(pageRef instanceof PDFRef, `destination ${id} starts with a page ref`);
    destinationPages.set(id, pageByRef.get(pageRef.toString()));
  }

  const linkTargets = [];
  const pageTexts = [];
  for (const page of pdf.getPages()) {
    const contents = dereference(context, page.node.get(PDFName.of('Contents')));
    const streams = contents instanceof PDFArray
      ? Array.from({ length: contents.size() }, (_, index) => contents.get(index))
      : [contents];
    let pageText = '';
    for (const rawStream of streams) {
      const stream = dereference(context, rawStream);
      if (!(stream instanceof PDFRawStream)) continue;
      const operators = new TextDecoder('latin1').decode(decodePDFRawStream(stream).decode());
      for (const match of operators.matchAll(/1 0 0 1 (-?[0-9.]+) (-?[0-9.]+) cm/g)) {
        assert.ok(
          Math.abs(Number(match[1])) < 10_000 && Math.abs(Number(match[2])) < 10_000,
          'content transformations remain within reasonable PDF bounds',
        );
      }
      for (const match of operators.matchAll(/<([0-9A-Fa-f]+)>/g)) {
        pageText += Buffer.from(match[1], 'hex').toString('latin1');
      }
    }
    pageTexts.push(pageText);

    const annotations = dereference(context, page.node.get(PDFName.of('Annots')));
    if (!(annotations instanceof PDFArray)) continue;
    for (let index = 0; index < annotations.size(); index += 1) {
      const annotation = dereference(context, annotations.get(index));
      if (!(annotation instanceof PDFDict)) continue;
      if (pdfName(annotation.get(PDFName.of('Subtype'))) !== '/Link') continue;
      const action = dereference(context, annotation.get(PDFName.of('A')));
      const destination = dereference(
        context,
        annotation.get(PDFName.of('Dest'))
          ?? (action instanceof PDFDict ? action.get(PDFName.of('D')) : undefined),
      );
      if (destination instanceof PDFString) linkTargets.push(destination.decodeText());
    }
  }

  return { pdf, destinationPages, linkTargets, pageTexts };
}

test('keeps the contents title with an entire long first row', async () => {
  const firstTitle = 'A deliberately long first entry whose words wrap across several lines at this narrow width so the complete row needs more than the title presence hint';
  const buffer = await renderToBuffer(h(
    Document,
    null,
    h(
      Page,
      { size: 'A4', style: styles.page },
      h(View, { style: { height: 680 } }, text('Preceding content')),
      h(
        View,
        { style: { width: 240 } },
        h(Contents, {
          entries: [{
            id: 'long-first-row',
            title: firstTitle,
            level: 1,
            pageNumber: 12,
          }],
        }),
      ),
      text('Destination', { id: 'long-first-row' }),
    ),
  ));
  const { pageTexts } = await inspectPdf(buffer);
  const titlePage = pageTexts.findIndex((pageText) => pageText.includes('Contents'));
  const firstRowPage = pageTexts.findIndex((pageText) => (
    pageText.includes('A deliberately long first entry')
  ));

  assert.notEqual(titlePage, -1);
  assert.notEqual(firstRowPage, -1);
  assert.equal(titlePage, firstRowPage);
});

test('resolves actual destinations, preserves metadata and links, and freezes values', async () => {
  const headings = [
    { id: 'intro', title: 'Overview' },
    { id: 'details', title: 'Overview', level: 2 },
  ];
  let firstEntries;
  let finalEntries;
  const result = await renderWithContents({
    headings,
    buildDocument(entries) {
      firstEntries ??= entries;
      finalEntries = entries;
      return basicDocument(entries, { headings, marker: 'Preserved output' });
    },
  });

  assert.deepEqual(firstEntries.map((entry) => entry.pageNumber), [null, null]);
  assert.ok(Object.isFrozen(firstEntries));
  assert.ok(firstEntries.every(Object.isFrozen));
  assert.ok(Object.isFrozen(finalEntries));
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.entries));
  assert.ok(result.entries.every(Object.isFrozen));
  assert.equal(result.passes, 2);
  assert.deepEqual(result.entries.map((entry) => entry.pageNumber), [2, 2]);

  const { pdf, destinationPages, linkTargets, pageTexts } = await inspectPdf(result.buffer);
  assert.equal(pdf.getTitle(), 'Preserved output');
  assert.equal(pdf.getAuthor(), 'Fixture Author');
  assert.equal(pdf.getCreator(), 'Fixture Creator');
  assert.equal(result.pageCount, pdf.getPageCount());
  assert.deepEqual(
    result.entries.map((entry) => destinationPages.get(entry.id)),
    [2, 2],
  );
  assert.ok(linkTargets.includes('intro'));
  assert.ok(linkTargets.includes('details'));

  result.buffer[0] = result.buffer[0];
  assert.equal(Object.isFrozen(result.buffer), false);
});

test('a contents section that grows after the first render needs three passes', async () => {
  const headings = Array.from({ length: 74 }, (_, index) => ({
    id: `section-${index + 1}`,
    title: `Section ${String(index + 1).padStart(2, '0')} with a deliberately descriptive title`,
    level: index % 5 === 0 ? 1 : 2,
  }));
  const seen = [];
  const factory = (entries) => {
    seen.push(entries.map((entry) => entry.pageNumber));
    return h(
      Document,
      { title: 'Growing contents fixture' },
      h(Page, { size: 'A4', style: styles.page }, text('Cover')),
      ...(entries[0]?.pageNumber === null
        ? [h(Page, { key: 'placeholder', size: 'A4', style: styles.page }, text('Contents will appear after page discovery'))]
        : [h(Page, { key: 'contents', size: 'A4', style: styles.page }, h(Contents, { entries }))]),
      h(
        Page,
        { size: 'A4', style: styles.page },
        ...headings.map((heading) => h(
          View,
          { key: heading.id, style: { height: 70 } },
          text(heading.title, { id: heading.id }),
        )),
      ),
    );
  };

  const result = await renderWithContents({ headings, buildDocument: factory });
  assert.equal(result.passes, 3);
  assert.equal(seen[0][0], null);
  assert.notDeepEqual(seen[1], seen[2]);
  const inspection = await inspectPdf(result.buffer);
  assert.deepEqual(
    result.entries.map((entry) => entry.pageNumber),
    result.entries.map((entry) => inspection.destinationPages.get(entry.id)),
  );
  assert.ok(result.entries.at(-1).pageNumber >= 10);

  await assert.rejects(
    renderWithContents({ headings, buildDocument: factory, maxPasses: 2 }),
    (error) => error instanceof ContentsConvergenceError
      && error.reason === 'limit'
      && error.passes === 2,
  );
});

test('detects an actual-layout page cycle', async () => {
  const headings = [{ id: 'pivot', title: 'Pivot' }];
  const result = renderWithContents({
    headings,
    buildDocument(entries) {
      const putOnThirdPage = entries[0].pageNumber === 2;
      return h(
        Document,
        null,
        h(Page, { size: 'A4' }, text('First')),
        h(Page, { size: 'A4' }, putOnThirdPage ? text('Second') : text('Pivot', { id: 'pivot' })),
        ...(putOnThirdPage ? [h(Page, { key: 'third', size: 'A4' }, text('Pivot', { id: 'pivot' }))] : []),
      );
    },
  });

  await assert.rejects(result, (error) => error instanceof ContentsConvergenceError
    && error.reason === 'cycle'
    && error.passes === 3);
});

test('allows stability on the final permitted pass', async () => {
  const headings = [{ id: 'late', title: 'Late' }];
  const result = await renderWithContents({
    headings,
    maxPasses: 2,
    buildDocument(entries) {
      return basicDocument(entries, { headings });
    },
  });
  assert.equal(result.passes, 2);
});

test('renders an empty heading list exactly once', async () => {
  let calls = 0;
  const result = await renderWithContents({
    headings: [],
    buildDocument(entries) {
      calls += 1;
      assert.ok(Object.isFrozen(entries));
      return h(Document, null, h(Page, { size: 'A4' }, text('No headings')));
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.passes, 1);
  assert.deepEqual(result.entries, []);
  assert.equal(result.pageCount, 1);
});

test('rejects missing destinations with the identifier in the error', async () => {
  await assert.rejects(
    renderWithContents({
      headings: [{ id: 'missing-id', title: 'Missing' }],
      buildDocument: (entries) => basicDocument(entries, { includeDestination: false }),
    }),
    /missing-id/,
  );
});

test('validates all input before calling the factory', async () => {
  const never = () => {
    assert.fail('factory must not be called');
  };
  const symbol = Symbol('unknown');
  const sparse = new Array(1);
  Object.setPrototypeOf(sparse, { 0: { id: 'inherited', title: 'Inherited' } });
  const nullPrototypeOptions = Object.assign(Object.create(null), {
    headings: [],
    buildDocument: () => h(Document, null, h(Page, null, text('ok'))),
  });

  await assert.doesNotReject(renderWithContents(nullPrototypeOptions));

  const cases = [
    ['non-object options', null, TypeError],
    ['non-plain options', new (class Options {})(), TypeError],
    ['unknown option', { headings: [], buildDocument: never, extra: true }, TypeError],
    ['symbol option', Object.assign({ headings: [], buildDocument: never }, { [symbol]: true }), TypeError],
    ['non-array headings', { headings: {}, buildDocument: never }, TypeError],
    ['sparse headings', { headings: sparse, buildDocument: never }, TypeError],
    ['non-object heading', { headings: [null], buildDocument: never }, TypeError],
    ['non-plain heading', { headings: [new (class Heading {})()], buildDocument: never }, TypeError],
    ['unknown heading field', { headings: [{ id: 'a', title: 'A', extra: 1 }], buildDocument: never }, TypeError],
    ['symbol heading field', { headings: [Object.assign({ id: 'a', title: 'A' }, { [symbol]: true })], buildDocument: never }, TypeError],
    ['non-string id', { headings: [{ id: 1, title: 'A' }], buildDocument: never }, TypeError],
    ['empty id', { headings: [{ id: '', title: 'A' }], buildDocument: never }, RangeError],
    ['hash id', { headings: [{ id: '#a', title: 'A' }], buildDocument: never }, RangeError],
    ['whitespace id', { headings: [{ id: 'a b', title: 'A' }], buildDocument: never }, RangeError],
    ['non-string title', { headings: [{ id: 'a', title: 2 }], buildDocument: never }, TypeError],
    ['blank title', { headings: [{ id: 'a', title: '  ' }], buildDocument: never }, RangeError],
    ['non-number level', { headings: [{ id: 'a', title: 'A', level: '2' }], buildDocument: never }, TypeError],
    ['fractional level', { headings: [{ id: 'a', title: 'A', level: 1.5 }], buildDocument: never }, RangeError],
    ['level below range', { headings: [{ id: 'a', title: 'A', level: 0 }], buildDocument: never }, RangeError],
    ['level above range', { headings: [{ id: 'a', title: 'A', level: 7 }], buildDocument: never }, RangeError],
    ['duplicate id', { headings: [{ id: 'a', title: 'A' }, { id: 'a', title: 'B' }], buildDocument: never }, RangeError],
    ['missing factory', { headings: [] }, TypeError],
    ['non-number passes', { headings: [], buildDocument: never, maxPasses: '2' }, TypeError],
    ['passes below range', { headings: [], buildDocument: never, maxPasses: 0 }, RangeError],
    ['passes above range', { headings: [], buildDocument: never, maxPasses: 21 }, RangeError],
    ['fractional passes', { headings: [], buildDocument: never, maxPasses: 2.5 }, RangeError],
  ];

  for (const [name, options, ErrorType] of cases) {
    await assert.rejects(renderWithContents(options), ErrorType, name);
  }
});

test('rejects async and non-Document factories', async () => {
  const headings = [{ id: 'a', title: 'A' }];
  await assert.rejects(
    renderWithContents({ headings, buildDocument: async () => basicDocument([], { headings }) }),
    TypeError,
  );
  await assert.rejects(
    renderWithContents({ headings, buildDocument: () => h(Page, null, text('A', { id: 'a' })) }),
    TypeError,
  );
  await assert.rejects(
    renderWithContents({ headings, buildDocument: () => null }),
    TypeError,
  );
});

test('copies heading input before yielding and isolates concurrent invocations', async () => {
  const mutable = [{ id: 'alpha', title: 'Alpha' }];
  const snapshots = [];
  const first = renderWithContents({
    headings: mutable,
    buildDocument(entries) {
      snapshots.push(entries.map(({ id, title }) => ({ id, title })));
      return basicDocument(entries, { headings: [{ id: 'alpha', title: 'Alpha' }], marker: 'Alpha PDF' });
    },
  });
  mutable[0].id = 'changed';
  mutable[0].title = 'Changed';

  const second = renderWithContents({
    headings: [{ id: 'beta', title: 'Beta' }],
    buildDocument(entries) {
      return basicDocument(entries, { headings: [{ id: 'beta', title: 'Beta' }], marker: 'Beta PDF' });
    },
  });

  const [alpha, beta] = await Promise.all([first, second]);
  assert.ok(snapshots.every(([entry]) => entry.id === 'alpha' && entry.title === 'Alpha'));
  assert.deepEqual(alpha.entries.map((entry) => entry.id), ['alpha']);
  assert.deepEqual(beta.entries.map((entry) => entry.id), ['beta']);
  assert.equal((await PDFDocument.load(alpha.buffer)).getTitle(), 'Alpha PDF');
  assert.equal((await PDFDocument.load(beta.buffer)).getTitle(), 'Beta PDF');
});

test('sample has two contents pages, ten pages, destinations, links, and readable text', { timeout: 120_000 }, async () => {
  const result = await renderWithContents({
    headings: sampleHeadings,
    buildDocument: createSampleDocument,
  });
  const { pdf, destinationPages, linkTargets, pageTexts } = await inspectPdf(result.buffer);
  const pages = pdf.getPages();
  assert.ok(result.pageCount >= 10);
  assert.ok(result.passes >= 2);
  assert.ok(result.entries.some((entry) => entry.pageNumber >= 10));
  assert.equal(result.entries[0].pageNumber, 4, 'cover and two flowing contents pages precede the body');
  assert.deepEqual(
    result.entries.map((entry) => entry.pageNumber),
    result.entries.map((entry) => destinationPages.get(entry.id)),
  );
  assert.ok(sampleHeadings.every((heading) => linkTargets.includes(heading.id)));
  const printedContents = pageTexts.slice(1, 3).join(' ');
  for (const entry of result.entries) {
    assert.ok(printedContents.includes(entry.title), `contents prints title ${entry.title}`);
    assert.ok(printedContents.includes(String(entry.pageNumber)), `contents prints page ${entry.pageNumber}`);
  }
  assert.equal(pdf.getTitle(), 'Field Notes: Systems in Motion');
  assert.equal(pdf.getAuthor(), 'Tevinch');
  assert.equal(pdf.getCreator(), 'Data Shape Kit');
  assert.ok(pages.length >= 10);
  for (let index = 1; index < pageTexts.length; index += 1) {
    assert.ok(pageTexts[index].includes('FIELD NOTES / SYSTEMS IN MOTION'));
    assert.ok(pageTexts[index].includes(`PAGE ${index + 1}`));
  }
  for (let index = 0; index < chapterTitlesForTest.length; index += 1) {
    const chapterLabel = `CHAPTER ${String(index + 1).padStart(2, '0')}`;
    const chapterPage = pageTexts.find((pageText) => pageText.includes(chapterLabel));
    assert.ok(chapterPage?.includes(chapterTitlesForTest[index]), `${chapterLabel} stays with its title`);
  }
  for (const pageText of pageTexts.slice(3)) {
    assert.doesNotMatch(pageText, /^[0-9]+: keep the smallest useful unit/);
    assert.equal(
      [...pageText.matchAll(/Supporting detail/g)].length,
      [...pageText.matchAll(/Field note [0-9]+:/g)].length,
      'each supporting-detail label stays with its callout',
    );
  }
});
