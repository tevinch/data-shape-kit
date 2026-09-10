/**
 * Map literal phrase matches in a page-wide text stream back to PDF.js text
 * item offsets, then render escaped per-item markup for React-PDF.
 *
 * @param {readonly ({ str: string, hasEOL?: boolean } | { type: string, id?: string })[]} items
 * @param {readonly string[]} queries
 * @param {{ caseSensitive?: boolean }} [options]
 * @returns {{ text: string, matches: { queryIndex: number, start: number, end: number, segments: { itemIndex: number, start: number, end: number }[] }[], html: string[] }}
 */
export function highlightTextItems(items, queries, options = {}) {
  validateArguments(items, queries, options);

  const itemRanges = [];
  let raw = '';

  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    const item = items[itemIndex];
    if (!isTextItem(item)) continue;
    const start = raw.length;
    raw += item.str;
    itemRanges.push({ itemIndex, start, end: raw.length });
    if (item.hasEOL) raw += ' ';
  }

  const normalized = normalize(raw);
  const projection = projectCase(normalized.text, options.caseSensitive === true);
  const matches = [];

  for (let queryIndex = 0; queryIndex < queries.length; queryIndex += 1) {
    const normalizedQuery = normalize(queries[queryIndex]).text.trim();
    const query = options.caseSensitive ? normalizedQuery : normalizedQuery.toLowerCase();
    if (!query) continue;

    let projectedStart = projection.text.indexOf(query);
    while (projectedStart !== -1) {
      const projectedEnd = projectedStart + query.length;
      const normalizedStart = projection.source[projectedStart].start;
      const normalizedEnd = projection.source[projectedEnd - 1].end;
      const rawStart = normalized.source[normalizedStart].start;
      const rawEnd = normalized.source[normalizedEnd - 1].end;
      const segments = itemRanges
        .map((range) => ({
          itemIndex: range.itemIndex,
          start: Math.max(rawStart, range.start) - range.start,
          end: Math.min(rawEnd, range.end) - range.start,
        }))
        .filter((segment) => segment.start < segment.end);

      matches.push({
        queryIndex,
        start: normalizedStart,
        end: normalizedEnd,
        segments,
      });
      projectedStart = projection.text.indexOf(query, projectedStart + 1);
    }
  }

  const intervalsByItem = Array.from({ length: items.length }, () => []);
  for (const match of matches) {
    for (const segment of match.segments) {
      intervalsByItem[segment.itemIndex].push({ start: segment.start, end: segment.end });
    }
  }

  return {
    text: normalized.text,
    matches,
    html: items.map((item, itemIndex) => (
      isTextItem(item) ? renderMarkedHtml(item.str, intervalsByItem[itemIndex]) : ''
    )),
  };
}

function validateArguments(items, queries, options) {
  if (!Array.isArray(items)) throw new TypeError('items must be an array');
  if (!Array.isArray(queries)) throw new TypeError('queries must be an array');
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('options must be an object');
  }
  if ('caseSensitive' in options && typeof options.caseSensitive !== 'boolean') {
    throw new TypeError('options.caseSensitive must be a boolean');
  }

  items.forEach((item, itemIndex) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      throw new TypeError(`items[${itemIndex}] must be a text or marked-content object`);
    }
    if ('str' in item) {
      if (typeof item.str !== 'string') {
        throw new TypeError(`items[${itemIndex}].str must be a string`);
      }
      if ('hasEOL' in item && typeof item.hasEOL !== 'boolean') {
        throw new TypeError(`items[${itemIndex}].hasEOL must be a boolean`);
      }
      return;
    }
    if (typeof item.type !== 'string') {
      throw new TypeError(`items[${itemIndex}].type must be a string`);
    }
    if ('id' in item && typeof item.id !== 'string') {
      throw new TypeError(`items[${itemIndex}].id must be a string`);
    }
  });

  queries.forEach((query, queryIndex) => {
    if (typeof query !== 'string') {
      throw new TypeError(`queries[${queryIndex}] must be a string`);
    }
  });
}

function isTextItem(item) {
  return 'str' in item;
}

function normalize(value) {
  let text = '';
  const source = [];

  for (let index = 0; index < value.length; ) {
    const codePoint = value.codePointAt(index);
    const character = String.fromCodePoint(codePoint);
    const end = index + character.length;

    if (/\s/u.test(character)) {
      let whitespaceEnd = end;
      while (whitespaceEnd < value.length) {
        const nextCodePoint = value.codePointAt(whitespaceEnd);
        const next = String.fromCodePoint(nextCodePoint);
        if (!/\s/u.test(next)) break;
        whitespaceEnd += next.length;
      }
      text += ' ';
      source.push({ start: index, end: whitespaceEnd });
      index = whitespaceEnd;
      continue;
    }

    text += character;
    for (let offset = 0; offset < character.length; offset += 1) {
      source.push({ start: index, end });
    }
    index = end;
  }

  return { text, source };
}

function projectCase(value, caseSensitive) {
  if (caseSensitive) {
    return {
      text: value,
      source: Array.from({ length: value.length }, (_, index) => ({
        start: index,
        end: index + 1,
      })),
    };
  }

  const text = value.toLowerCase();
  const source = [];
  for (let index = 0; index < value.length; ) {
    const codePoint = value.codePointAt(index);
    const character = String.fromCodePoint(codePoint);
    const end = index + character.length;
    const projectedLength = character.toLowerCase().length;
    for (let offset = 0; offset < projectedLength; offset += 1) {
      source.push({ start: index, end });
    }
    index = end;
  }

  if (source.length !== text.length) {
    throw new Error('Unable to map lowercase text back to source offsets');
  }
  return { text, source };
}

function renderMarkedHtml(value, intervals) {
  if (intervals.length === 0) return escapeHtml(value);

  const sorted = intervals.toSorted((left, right) => left.start - right.start || left.end - right.end);
  const merged = [];
  for (const interval of sorted) {
    const previous = merged.at(-1);
    if (previous && interval.start <= previous.end) {
      previous.end = Math.max(previous.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }

  let html = '';
  let cursor = 0;
  for (const interval of merged) {
    html += escapeHtml(value.slice(cursor, interval.start));
    html += `<mark>${escapeHtml(value.slice(interval.start, interval.end))}</mark>`;
    cursor = interval.end;
  }
  return html + escapeHtml(value.slice(cursor));
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}
