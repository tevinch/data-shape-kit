import {
  Document,
  renderToBuffer,
  type DocumentProps,
} from '@react-pdf/renderer';
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRef,
  PDFString,
  type PDFContext,
  type PDFObject,
} from 'pdf-lib';
import React, { type ReactElement } from 'react';

export interface Heading {
  readonly id: string;
  readonly title: string;
  readonly level?: number;
}

export interface ContentsEntry {
  readonly id: string;
  readonly title: string;
  readonly level: number;
  readonly pageNumber: number | null;
}

export interface ResolvedContentsEntry extends ContentsEntry {
  readonly pageNumber: number;
}

export interface RenderContentsOptions {
  readonly headings: readonly Heading[];
  readonly buildDocument: (
    entries: readonly ContentsEntry[],
  ) => ReactElement<DocumentProps>;
  readonly maxPasses?: number;
}

export interface ContentsResult {
  readonly buffer: Buffer;
  readonly entries: readonly ResolvedContentsEntry[];
  readonly pageCount: number;
  readonly passes: number;
}

export class ContentsConvergenceError extends Error {
  readonly passes: number;
  readonly reason: 'cycle' | 'limit';

  constructor(reason: 'cycle' | 'limit', passes: number) {
    super(
      reason === 'cycle'
        ? `Contents page numbers entered a cycle after ${passes} passes`
        : `Contents page numbers did not stabilize within ${passes} passes`,
    );
    this.name = 'ContentsConvergenceError';
    this.reason = reason;
    this.passes = passes;
  }
}

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const optionKeys = new Set<PropertyKey>([
  'headings',
  'buildDocument',
  'maxPasses',
]);
const headingKeys = new Set<PropertyKey>(['id', 'title', 'level']);

function isPlainObject(value: unknown): value is Record<PropertyKey, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function rejectUnknownKeys(
  value: Record<PropertyKey, unknown>,
  allowed: ReadonlySet<PropertyKey>,
  label: string,
): void {
  for (const key of Reflect.ownKeys(value)) {
    if (!allowed.has(key)) {
      throw new TypeError(`${label} contains unknown key ${String(key)}`);
    }
  }
}

function validateOptions(options: RenderContentsOptions): {
  headings: readonly Readonly<Required<Heading>>[];
  buildDocument: RenderContentsOptions['buildDocument'];
  maxPasses: number;
} {
  if (!isPlainObject(options)) {
    throw new TypeError('options must be a plain object');
  }
  rejectUnknownKeys(options, optionKeys, 'options');

  if (!Object.hasOwn(options, 'headings') || !Array.isArray(options.headings)) {
    throw new TypeError('options.headings must be an array');
  }
  if (
    !Object.hasOwn(options, 'buildDocument')
    || typeof options.buildDocument !== 'function'
  ) {
    throw new TypeError('options.buildDocument must be a function');
  }

  const arrayKeys = Reflect.ownKeys(options.headings);
  for (const key of arrayKeys) {
    if (key === 'length') continue;
    if (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/.test(key)) {
      throw new TypeError(`options.headings contains unknown key ${String(key)}`);
    }
  }

  const seenIds = new Set<string>();
  const headings: Readonly<Required<Heading>>[] = [];
  for (let index = 0; index < options.headings.length; index += 1) {
    if (!Object.hasOwn(options.headings, index)) {
      throw new TypeError(`options.headings must not be sparse (missing index ${index})`);
    }
    const heading = options.headings[index];
    if (!isPlainObject(heading)) {
      throw new TypeError(`heading at index ${index} must be a plain object`);
    }
    rejectUnknownKeys(heading, headingKeys, `heading at index ${index}`);
    if (typeof heading.id !== 'string') {
      throw new TypeError(`heading at index ${index} has a non-string id`);
    }
    if (!idPattern.test(heading.id)) {
      throw new RangeError(`heading id ${JSON.stringify(heading.id)} is invalid`);
    }
    if (seenIds.has(heading.id)) {
      throw new RangeError(`heading id ${JSON.stringify(heading.id)} is duplicated`);
    }
    if (typeof heading.title !== 'string') {
      throw new TypeError(`heading ${JSON.stringify(heading.id)} has a non-string title`);
    }
    if (heading.title.trim().length === 0) {
      throw new RangeError(`heading ${JSON.stringify(heading.id)} has an empty title`);
    }
    const level = heading.level === undefined ? 1 : heading.level;
    if (typeof level !== 'number') {
      throw new TypeError(`heading ${JSON.stringify(heading.id)} has a non-number level`);
    }
    if (!Number.isInteger(level) || level < 1 || level > 6) {
      throw new RangeError(`heading ${JSON.stringify(heading.id)} level must be an integer from 1 to 6`);
    }

    seenIds.add(heading.id);
    headings.push(Object.freeze({
      id: heading.id,
      title: heading.title,
      level,
    }));
  }

  const maxPasses = options.maxPasses === undefined ? 6 : options.maxPasses;
  if (typeof maxPasses !== 'number') {
    throw new TypeError('options.maxPasses must be a number');
  }
  if (!Number.isInteger(maxPasses) || maxPasses < 1 || maxPasses > 20) {
    throw new RangeError('options.maxPasses must be an integer from 1 to 20');
  }

  return {
    headings: Object.freeze(headings),
    buildDocument: options.buildDocument,
    maxPasses,
  };
}

function resolve(context: PDFContext, value: PDFObject | undefined): PDFObject | undefined {
  return value instanceof PDFRef ? context.lookup(value) : value;
}

function collectDestinationNames(
  context: PDFContext,
  value: PDFObject | undefined,
  output: Map<string, PDFObject>,
  visited: Set<PDFObject | string>,
): void {
  const node = resolve(context, value);
  if (!(node instanceof PDFDict)) {
    throw new Error('PDF destination name tree contains an invalid node');
  }

  const identity = value instanceof PDFRef ? value.toString() : node;
  if (visited.has(identity)) {
    throw new Error('PDF destination name tree contains a cycle');
  }
  visited.add(identity);

  const names = resolve(context, node.get(PDFName.of('Names')));
  if (names !== undefined) {
    if (!(names instanceof PDFArray) || names.size() % 2 !== 0) {
      throw new Error('PDF destination name tree contains an invalid Names array');
    }
    for (let index = 0; index < names.size(); index += 2) {
      const name = resolve(context, names.get(index));
      if (!(name instanceof PDFString) && !(name instanceof PDFHexString)) {
        throw new Error('PDF destination name tree contains an invalid name');
      }
      const decoded = name.decodeText();
      if (output.has(decoded)) {
        throw new Error(`PDF destination ${JSON.stringify(decoded)} occurs more than once`);
      }
      output.set(decoded, names.get(index + 1));
    }
  }

  const kids = resolve(context, node.get(PDFName.of('Kids')));
  if (kids !== undefined) {
    if (!(kids instanceof PDFArray)) {
      throw new Error('PDF destination name tree contains an invalid Kids array');
    }
    for (let index = 0; index < kids.size(); index += 1) {
      collectDestinationNames(context, kids.get(index), output, visited);
    }
  }
}

async function readDestinations(
  buffer: Buffer,
  headings: readonly Readonly<Required<Heading>>[],
): Promise<{ pageCount: number; pageNumbers: readonly number[] }> {
  const pdf = await PDFDocument.load(buffer);
  const context = pdf.context;
  const pages = pdf.getPages();
  const pageByReference = new Map(
    pages.map((page, index) => [page.ref.toString(), index + 1]),
  );

  const destinations = new Map<string, PDFObject>();
  const names = resolve(context, pdf.catalog.get(PDFName.of('Names')));
  if (names !== undefined) {
    if (!(names instanceof PDFDict)) {
      throw new Error('PDF catalog Names entry is invalid');
    }
    const destinationTree = names.get(PDFName.of('Dests'));
    if (destinationTree !== undefined) {
      collectDestinationNames(context, destinationTree, destinations, new Set());
    }
  }

  const pageNumbers = headings.map((heading) => {
    const rawDestination = destinations.get(heading.id);
    if (rawDestination === undefined) {
      throw new Error(`PDF is missing named destination ${JSON.stringify(heading.id)}`);
    }
    let destination = resolve(context, rawDestination);
    if (destination instanceof PDFDict) {
      destination = resolve(context, destination.get(PDFName.of('D')));
    }
    if (!(destination instanceof PDFArray) || destination.size() === 0) {
      throw new Error(`PDF named destination ${JSON.stringify(heading.id)} is invalid`);
    }
    const pageReference = destination.get(0);
    if (!(pageReference instanceof PDFRef)) {
      throw new Error(`PDF named destination ${JSON.stringify(heading.id)} has no valid page reference`);
    }
    const pageNumber = pageByReference.get(pageReference.toString());
    if (pageNumber === undefined) {
      throw new Error(`PDF named destination ${JSON.stringify(heading.id)} points outside the document`);
    }
    return pageNumber;
  });

  return { pageCount: pages.length, pageNumbers };
}

function freezeEntries(
  headings: readonly Readonly<Required<Heading>>[],
  pageNumbers: readonly (number | null)[],
): readonly ContentsEntry[] {
  return Object.freeze(headings.map((heading, index) => Object.freeze({
    id: heading.id,
    title: heading.title,
    level: heading.level,
    pageNumber: pageNumbers[index] ?? null,
  })));
}

export async function renderWithContents(
  options: RenderContentsOptions,
): Promise<ContentsResult> {
  const { headings, buildDocument, maxPasses } = validateOptions(options);
  let entries = freezeEntries(headings, headings.map(() => null));
  const signatures = new Set<string>();

  for (let passes = 1; passes <= maxPasses; passes += 1) {
    const document = buildDocument(entries);
    if (!React.isValidElement(document) || document.type !== Document) {
      throw new TypeError('buildDocument must synchronously return a react-pdf Document element');
    }

    const buffer = await renderToBuffer(document);
    const { pageCount, pageNumbers } = await readDestinations(buffer, headings);
    const suppliedNumbers = entries.map((entry) => entry.pageNumber);
    const isStable = headings.length === 0
      || suppliedNumbers.every((pageNumber, index) => pageNumber === pageNumbers[index]);
    const resolvedEntries = freezeEntries(headings, pageNumbers) as readonly ResolvedContentsEntry[];

    if (isStable) {
      return Object.freeze({
        buffer,
        entries: resolvedEntries,
        pageCount,
        passes,
      });
    }

    const signature = pageNumbers.join(',');
    if (signatures.has(signature)) {
      throw new ContentsConvergenceError('cycle', passes);
    }
    signatures.add(signature);

    if (passes === maxPasses) {
      throw new ContentsConvergenceError('limit', passes);
    }
    entries = resolvedEntries;
  }

  throw new ContentsConvergenceError('limit', maxPasses);
}
