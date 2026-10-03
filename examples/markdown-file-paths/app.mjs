import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Markdown } from '@tiptap/markdown';
import { FilePathLink, FilePathImage } from './markdown-file-paths.mjs';

const stock = new URLSearchParams(location.search).has('stock');
const initial = '[My plan](<docs/My Plan.md>)\n\n![Photo](<images/My Photo.svg>)\n\nKeep **this** paragraph.';
let saved = initial;
let reopens = 0;
let editor;

function renderState() {
  const doc = editor.getJSON();
  const paths = [];
  const visit = node => {
    for (const mark of node.marks ?? []) {
      if (mark.type === 'link') paths.push({ type: 'link', href: mark.attrs.href });
    }
    if (node.type === 'image') paths.push({ type: 'image', src: node.attrs.src });
    for (const child of node.content ?? []) visit(child);
  };
  visit(doc);
  document.querySelector('#paths').textContent = JSON.stringify(paths, null, 2);
  document.querySelector('#json').textContent = JSON.stringify(doc, null, 2);
  document.querySelector('#saved').textContent = saved;
}

function open(content) {
  editor?.destroy();
  document.querySelector('#editor').replaceChildren();
  editor = new Editor({
    element: document.querySelector('#editor'),
    extensions: [StarterKit.configure({ link: false }),
      (stock ? Link : FilePathLink).configure({ openOnClick: false }),
      stock ? Image : FilePathImage, Markdown],
    content, contentType: 'markdown',
    editorProps: { attributes: { 'aria-label': 'Document editor', role: 'textbox' } },
    onUpdate: renderState,
  });
  renderState();
}

document.querySelector('#mode').textContent = stock ? 'Stock Tiptap 3.31.4 (comparison)' : 'Tiptap 3.31.4 with file-path extensions';
document.querySelector('#save').addEventListener('click', () => {
  saved = editor.getMarkdown(); renderState();
  document.querySelector('#status').textContent = 'Markdown saved in this page. Ready to reopen.';
});
document.querySelector('#reopen').addEventListener('click', () => {
  open(saved); reopens++;
  document.querySelector('#status').textContent = `Reopened saved Markdown ${reopens} time(s).`;
});
document.querySelector('#reset').addEventListener('click', () => {
  saved = initial; reopens = 0; open(saved);
  document.querySelector('#status').textContent = 'Example reset.';
});
open(saved);
