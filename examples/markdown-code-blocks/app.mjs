import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import CodeBlock from '@tiptap/extension-code-block';
import { Markdown } from '@tiptap/markdown';
import { MarkdownCodeBlock } from './code-block.mjs';

const source = document.querySelector('#source');
const status = document.querySelector('#status');
const readonly = document.querySelector('#readonly');
const stock = new URLSearchParams(location.search).has('stock');
source.value = 'before **bold**\n\n  ```python\n  if ready:\n      print("Hello")\n  ```\n\nafter';
let saved = source.value;
let editor;
function open(content) {
  editor?.destroy();
  editor = new Editor({
    element: document.querySelector('#editor'),
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      (stock ? CodeBlock : MarkdownCodeBlock).configure({
        HTMLAttributes: { class: 'code-sample' }, languageClassPrefix: 'syntax-',
        enableTabIndentation: true, tabSize: 2, exitOnTripleEnter: false,
      }),
      Markdown,
    ],
    content, contentType: 'markdown', editable: !readonly.checked,
  });
  window.editor = editor;
}
document.querySelector('#import').addEventListener('click', () => {
  editor.commands.setContent(source.value, { contentType: 'markdown' });
  status.textContent = 'Imported. Edit the code below before saving.';
});
document.querySelector('#save').addEventListener('click', () => {
  saved = editor.getMarkdown();
  source.value = saved;
  status.textContent = 'Saved in this page. Reopen to check the saved content.';
});
document.querySelector('#reopen').addEventListener('click', () => {
  open(saved);
  status.textContent = 'Reopened the saved Markdown in a new editor.';
});
readonly.addEventListener('change', () => editor.setEditable(!readonly.checked));
open(saved);
status.textContent = stock ? 'Using the original CodeBlock extension.' : 'Ready to edit.';
