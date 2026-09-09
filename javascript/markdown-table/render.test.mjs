// Copyright (c) 2026 Tevinch. SPDX-License-Identifier: MIT
// Optional integration check: node render.test.mjs /absolute/path/to/marked.esm.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMarkdown } from './index.mjs';
const { marked } = await import(process.argv[2] || 'marked');
const decode = text => text.replace(/&(?:amp|lt|gt|quot|#39|#\d+|#x[0-9a-f]+);/gi, entity => {
  const named = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
  return named[entity] ?? String.fromCodePoint(entity[2].toLowerCase() === 'x' ? parseInt(entity.slice(3, -1), 16) : Number(entity.slice(2, -1)));
});

test('GFM renderer preserves literal cells and keeps subsequent rows in the table', () => {
  const printableAscii = Array.from({ length: 95 }, (_, i) => `a${String.fromCharCode(32 + i)}b`);
  const cells = ['Name', 'a|b\\c *bold* <img> &copy; [x](url) `code` $2', '\\|', '\\\\|', '&amp;',
    'line1\r\nline2', 'www.example.com', 'https://example.com', 'name@example.com', '小明😀', '',
    'a\u2028b', 'a\u2029b', '\u2028', '\u2029', ...printableAscii];
  for (const cell of cells) {
    const html = marked.parse(formatMarkdown([['Header'], [cell], ['next']]).markdown, { gfm: true });
    const bodyCells = [...html.matchAll(/<td(?:\s[^>]*)?>([\s\S]*?)<\/td>/g)].map(match =>
      decode(match[1].replaceAll('<br>', '\n')));
    assert.deepEqual(bodyCells, [cell.replaceAll('\r\n', '\n').replaceAll('\r', '\n'), 'next'], JSON.stringify(cell));
    for (const tag of html.matchAll(/<\/?([a-z][a-z0-9]*)\b/gi)) {
      assert.ok(['table', 'thead', 'tbody', 'tr', 'th', 'td', 'br'].includes(tag[1]), tag[0]);
    }
  }
  assert.equal(cells.length, 110);
});
