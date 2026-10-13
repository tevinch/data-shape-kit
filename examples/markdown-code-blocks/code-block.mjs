import CodeBlock from '@tiptap/extension-code-block';

// Keep Tiptap's schema, options and commands; change only Markdown conversion.
export const MarkdownCodeBlock = CodeBlock.extend({
  parseMarkdown(token, helpers) {
    const opening = token.raw?.match(/^( {1,3})(?=`{3,}|~{3,})/);
    if (!opening) return this.parent(token, helpers);

    // Marked 17 changes indentation, but preserves the number of code lines.
    // Read those original lines so an indented content fence cannot become a
    // closer. Re-lexing a dedented block would change that boundary.
    const rawLines = token.raw.split('\n');
    // Empty text can also mean Marked removed a whitespace-only code line.
    // Recover that line, but don't mistake an immediate closer for content.
    const lines = token.text === '' && !/^\s*$/.test(rawLines[1] ?? '')
      ? 0 : token.text.split('\n').length;
    const indent = new RegExp(`^ {1,${opening[1].length}}`);
    const text = rawLines.slice(1, 1 + lines)
      .map(line => line.replace(indent, '')).join('\n');
    const raw = token.raw.slice(opening[1].length);
    return this.parent({ ...token, raw, text }, helpers);
  },

  renderMarkdown(node) {
    const text = (node.content ?? []).map(child => child.text ?? '').join('');
    const language = node.attrs?.language || '';
    const marker = language.includes('`') ? '~' : '`';
    let length = 3;
    for (const run of text.matchAll(new RegExp(`${marker}+`, 'g'))) length = Math.max(length, run[0].length + 1);
    const fence = marker.repeat(length);
    const info = language ? ' ' + language.replace(/\\/g, '\\\\') : '';
    return `${fence}${info}\n${text}\n${fence}`;
  },
});
