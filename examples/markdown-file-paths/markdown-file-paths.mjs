import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';

function destination(path) {
  return /[ \t]/.test(path)
    ? `<${path.replace(/[\\<>]/g, '\\$&')}>`
    : path;
}

export const FilePathLink = Link.extend({
  renderMarkdown(node, helpers) {
    return this.parent({
      ...node,
      attrs: { ...node.attrs, href: destination(node.attrs?.href ?? '') },
    }, helpers);
  },
});

export const FilePathImage = Image.extend({
  renderMarkdown(node, helpers) {
    return this.parent({
      ...node,
      attrs: { ...node.attrs, src: destination(node.attrs?.src ?? '') },
    }, helpers);
  },
});
