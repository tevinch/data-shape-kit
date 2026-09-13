import { Editor, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { IsolatedListDelete } from './isolated-list-delete.mjs';

const Frame = Node.create({
  name: 'frame', content: 'block+', isolating: true,
  addAttributes: () => ({ id: { default: null } }),
  renderHTML: ({ node }) => ['section', { 'data-frame': node.attrs.id }, 0],
});
const Page = Node.create({ name: 'doc', topNode: true, content: 'frame*' });
const paragraph = text => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const initial = { type: 'doc', content: [
  { type: 'frame', attrs: { id: 'first' }, content: [
    { type: 'orderedList', content: [{ type: 'listItem', content: [paragraph('A')] }] },
    paragraph('B'),
  ] },
  { type: 'frame', attrs: { id: 'second' }, content: [paragraph('C')] },
] };

for (const enabled of [false, true]) {
  const label = enabled ? 'With extension' : 'Original';
  const section = document.createElement('article'); section.className = 'example';
  const heading = document.createElement('h2'); heading.textContent = label;
  const focus = document.createElement('button'); focus.textContent = `Place cursor after A — ${label}`;
  const reset = document.createElement('button'); reset.textContent = `Reset — ${label}`;
  const undo = document.createElement('button'); undo.textContent = `Undo — ${label}`;
  const mount = document.createElement('div');
  const status = document.createElement('p'); status.className = 'result'; status.setAttribute('aria-live', 'polite');
  const state = document.createElement('pre'); state.setAttribute('aria-label', `${label} document JSON`);
  section.append(heading, focus, reset, undo, mount, status, state);
  document.querySelector('#examples').append(section);
  let initialSecond;
  const update = editor => {
    const json = editor.getJSON();
    state.textContent = JSON.stringify(json, null, 2);
    const first = editor.state.doc.firstChild;
    const second = editor.state.doc.maybeChild(1);
    const fullResult = editor.state.doc.childCount === 2
      && first.childCount === 1 && first.firstChild.type.name === 'orderedList'
      && first.firstChild.childCount === 1 && first.firstChild.firstChild.childCount === 1
      && first.firstChild.firstChild.firstChild.textContent === 'AB'
      && JSON.stringify(second.toJSON()) === initialSecond;
    status.textContent = fullResult ? 'Complete result: one list item AB; second frame unchanged.'
      : `Current text: ${editor.state.doc.textContent}. Frames: ${editor.state.doc.childCount}.`;
  };
  const editor = new Editor({
    element: mount,
    editorProps: { attributes: { 'aria-label': `${label} editor` } },
    extensions: [Page, Frame, StarterKit.configure({ document: false }), ...(enabled ? [IsolatedListDelete] : [])],
    content: structuredClone(initial),
    onUpdate: ({ editor }) => update(editor),
  });
  initialSecond = JSON.stringify(editor.state.doc.child(1).toJSON());
  update(editor);
  focus.onclick = () => {
    let position = null;
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text.startsWith('A') && position === null) position = pos + 1;
    });
    if (position !== null) editor.commands.focus(position);
  };
  reset.onclick = () => { editor.commands.setContent(structuredClone(initial)); update(editor); };
  undo.onclick = () => { editor.commands.undo(); update(editor); };
}
