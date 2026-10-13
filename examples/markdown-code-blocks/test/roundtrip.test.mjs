import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import CodeBlock from '@tiptap/extension-code-block';
import { cases } from './cases.mjs';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const key of ['window', 'document', 'navigator', 'Node', 'HTMLElement', 'Element', 'MutationObserver', 'DOMParser', 'getComputedStyle']) {
  Object.defineProperty(globalThis, key, { value: key === 'window' ? dom.window : dom.window[key], configurable: true });
}
const Extension = process.env.CHECK_STOCK === '1' ? CodeBlock : (await import('../code-block.mjs')).MarkdownCodeBlock;
const options = { HTMLAttributes: { class: 'code-sample' }, languageClassPrefix: 'syntax-', enableTabIndentation: true, tabSize: 2, exitOnTripleEnter: false };
function editor(content) {
  return new Editor({ element: document.createElement('div'), extensions: [StarterKit.configure({ codeBlock: false }), Extension.configure(options), Markdown], content, contentType: 'markdown' });
}
function check(instance, value, suffix = '') {
  instance.state.doc.check();
  const json = instance.getJSON();
  assert.deepEqual(json.content.map(node => node.type), ['paragraph', 'codeBlock', 'paragraph']);
  assert.equal(json.content[0].content[0].text, 'before ');
  assert.deepEqual(json.content[0].content[1], { type: 'text', marks: [{ type: 'bold' }], text: 'bold' });
  assert.equal(json.content[2].content[0].text, 'after');
  assert.equal(json.content[1].attrs.language, value.language);
  assert.equal(instance.state.doc.child(1).textContent, value.text + suffix);
  assert.equal(instance.view.dom.querySelector('pre').className, 'code-sample');
  assert.equal(instance.view.dom.querySelector('code').className, value.language ? 'syntax-' + value.language : '');
}

// Removing the import handler loses the middle node; using a short output fence
// corrupts the code on the next pass. Literal expected content catches both.
for (const value of cases) {
  test(value.name + ': edit, save, reload and reopen preserve the code', () => {
    let instance = editor(value.source);
    try {
      check(instance, value);
      instance.commands.setContent(instance.getMarkdown(), { contentType: 'markdown' });
      check(instance, value);
      const pos = instance.state.doc.child(0).nodeSize + 1 + value.text.length;
      instance.commands.setTextSelection(pos);
      instance.view.dispatch(instance.state.tr.insertText(' // changed'));
      check(instance, value, ' // changed');
      for (let turn = 0; turn < 3; turn++) {
        const saved = instance.getMarkdown();
        instance.commands.setContent(saved, { contentType: 'markdown' });
        check(instance, value, ' // changed');
        instance.destroy();
        instance = editor(saved);
        check(instance, value, ' // changed');
      }
    } finally { instance.destroy(); }
  });
}

test('multiple blocks and an ordinary paragraph keep their boundaries', () => {
  const source = ' ```js\n first\n ```\n\nmiddle\n\n  ~~~python\n  second\n  ~~~\n\nafter';
  let instance = editor(source);
  try {
    for (let turn = 0; turn < 3; turn++) {
      instance.state.doc.check();
      assert.deepEqual(instance.getJSON().content.map(node => node.type), ['codeBlock', 'paragraph', 'codeBlock', 'paragraph']);
      assert.equal(instance.state.doc.child(0).textContent, 'first');
      assert.equal(instance.state.doc.child(1).textContent, 'middle');
      assert.equal(instance.state.doc.child(2).textContent, 'second');
      assert.equal(instance.state.doc.child(3).textContent, 'after');
      instance.commands.setContent(instance.getMarkdown(), { contentType: 'markdown' });
    }
  } finally { instance.destroy(); }
});

test('unclosed fence consumes through the document end without losing code', () => {
  const instance = editor('before\n\n  ~~~\n one\n    two');
  try {
    for (let turn = 0; turn < 3; turn++) {
      assert.equal(instance.state.doc.child(0).textContent, 'before');
      assert.equal(instance.state.doc.child(1).type.name, 'codeBlock');
      assert.equal(instance.state.doc.child(1).textContent, 'one\n  two');
      instance.commands.setContent(instance.getMarkdown(), { contentType: 'markdown' });
    }
  } finally { instance.destroy(); }
});

test('blockquote keeps the code inside the quote across repeated saves', () => {
  const instance = editor('> before\n>\n>  ```js\n>  code\n>  ```\n\nafter');
  try {
    for (let turn = 0; turn < 3; turn++) {
      const quote = instance.state.doc.child(0);
      assert.equal(quote.type.name, 'blockquote');
      assert.equal(quote.child(1).type.name, 'codeBlock');
      assert.equal(quote.child(1).textContent, 'code');
      instance.commands.setContent(instance.getMarkdown(), { contentType: 'markdown' });
    }
  } finally { instance.destroy(); }
});

for (const fence of ['```', '~~~']) {
  test(`unclosed ${fence} retains an indented fence-looking final line`, () => {
    const instance = editor(`before\n\n  ${fence}\n  keep me\n    ${fence}`);
    try {
      for (let turn = 0; turn < 3; turn++) {
        assert.equal(instance.state.doc.child(1).textContent, `keep me\n  ${fence}`);
        instance.commands.setContent(instance.getMarkdown(), { contentType: 'markdown' });
      }
    } finally { instance.destroy(); }
  });
  test(`indented ${fence} opener at EOF remains an empty code block`, () => {
    const instance = editor(`before\n\n  ${fence}`);
    try {
      for (let turn = 0; turn < 3; turn++) {
        assert.equal(instance.state.doc.child(1).type.name, 'codeBlock');
        assert.equal(instance.state.doc.child(1).textContent, '');
        instance.commands.setContent(instance.getMarkdown(), { contentType: 'markdown' });
      }
    } finally { instance.destroy(); }
  });
}
