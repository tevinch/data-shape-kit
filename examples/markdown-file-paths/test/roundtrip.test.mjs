import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Markdown } from '@tiptap/markdown';
import { FilePathLink, FilePathImage } from '../markdown-file-paths.mjs';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
for (const name of ['window', 'document', 'Node', 'HTMLElement', 'navigator', 'getComputedStyle']) {
  const value = name === 'getComputedStyle' ? dom.window[name].bind(dom.window) : dom.window[name];
  Object.defineProperty(globalThis, name, { value, configurable: true });
}

const extensions = (inline = false) => [
  StarterKit.configure({ link: false }), process.env.STOCK ? Link : FilePathLink,
  (process.env.STOCK ? Image : FilePathImage).configure({ inline }), Markdown,
];

function create(content, inline = false) {
  return new Editor({ extensions: extensions(inline), content, contentType: 'markdown' });
}

function paths(doc) {
  const result = [];
  const visit = node => {
    for (const mark of node.marks ?? []) {
      if (mark.type === 'link') result.push(['link', mark.attrs.href, mark.attrs.title]);
    }
    if (node.type === 'image') result.push(['image', node.attrs.src, node.attrs.alt, node.attrs.title]);
    for (const child of node.content ?? []) visit(child);
  };
  visit(doc);
  return result;
}

const cases = [
  {
    name: 'entity-looking text in file names stays literal',
    markdown: '[Plan](<docs/My &copy; Plan.md>)\n\n![Photo](<images/My &#65; Photo.png>)',
    expected: [['link', 'docs/My &copy; Plan.md', null], ['image', 'images/My &#65; Photo.png', 'Photo', null]],
  },
  {
    name: 'original block link and image survive editing, saving and reopening',
    markdown: '[My plan](<docs/My Plan.md>)\n\n![Photo](<images/My Photo.png>)\n\nKeep **this** paragraph.',
    expected: [['link', 'docs/My Plan.md', null], ['image', 'images/My Photo.png', 'Photo', null]],
  },
  {
    name: 'inline images retain their place in the paragraph',
    markdown: 'Before ![Photo](<images/My Photo.png> "A photo") after [Plan](<docs/My Plan.md> "A plan").',
    inline: true,
    expected: [['image', 'images/My Photo.png', 'Photo', 'A photo'], ['link', 'docs/My Plan.md', 'A plan']],
  },
  {
    name: 'spaces combined with parentheses, Unicode and escaped angle brackets',
    markdown: String.raw`[Plan](<docs/我的 Plan (2)\<final\>.md>)` + '\n\n' + String.raw`![Photo](<images/My \\ Photo.png>)`,
    expected: [['link', 'docs/我的 Plan (2)<final>.md', null], ['image', 'images/My \\ Photo.png', 'Photo', null]],
  },
  {
    name: 'ordinary paths and encoded spaces remain usable',
    markdown: '[Plan](docs/Plan.md)\n\n![Photo](images/My%20Photo.png)',
    expected: [['link', 'docs/Plan.md', null], ['image', 'images/My%20Photo.png', 'Photo', null]],
  },
];

for (const fixture of cases) {
  test(fixture.name, () => {
    let editor = create(fixture.markdown, fixture.inline);
    try {
      assert.deepEqual(paths(editor.getJSON()), fixture.expected, 'input must contain real links and images');
      assert.equal(editor.commands.insertContentAt(1, 'Edited: '), true);
      const expectedDoc = editor.getJSON();
      for (let cycle = 1; cycle <= 3; cycle++) {
        const saved = editor.getMarkdown();
        editor.destroy();
        editor = create(saved, fixture.inline);
        assert.deepEqual(paths(editor.getJSON()), fixture.expected, `destinations after cycle ${cycle}: ${saved}`);
        assert.deepEqual(editor.getJSON(), expectedDoc, `whole document after cycle ${cycle}`);
      }
    } finally {
      editor.destroy();
    }
  });
}

test('configured link validation and HTML attributes still apply', () => {
  let validationCalls = 0;
  const ActiveLink = process.env.STOCK ? Link : FilePathLink;
  const editor = new Editor({
    extensions: [StarterKit.configure({ link: false }), ActiveLink.configure({
      HTMLAttributes: { target: '_self', 'data-document': 'local' },
      isAllowedUri: href => { validationCalls++; return href.startsWith('docs/'); },
    }), Markdown],
    content: '<p>Plan</p>',
  });
  try {
    editor.commands.selectAll();
    assert.equal(editor.commands.setLink({ href: 'docs/My Plan.md' }), true);
    const accepted = editor.getJSON();
    assert.equal(editor.commands.setLink({ href: 'other/My Plan.md' }), false);
    assert.ok(validationCalls >= 2, 'configured validator must actually run');
    assert.deepEqual(editor.getJSON(), accepted, 'rejected edit must preserve content');
    const html = new JSDOM(editor.getHTML());
    const link = html.window.document.querySelector('a');
    assert.equal(link.getAttribute('href'), 'docs/My Plan.md');
    assert.equal(link.getAttribute('target'), '_self');
    assert.equal(link.getAttribute('data-document'), 'local');
    html.window.close();
  } finally { editor.destroy(); }
});
