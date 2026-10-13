export const cases = [
  ...[0, 1, 2, 3].flatMap(indent => ['```', '~~~'].map(fence => ({
    name: `${indent} spaces before ${fence}`,
    source: `before **bold**\n\n${' '.repeat(indent)}${fence}js\n${' '.repeat(indent)}const value = 1;\n${' '.repeat(indent)}${fence}\n\nafter`,
    text: 'const value = 1;', language: 'js',
  }))),
  { name: 'empty block', source: 'before **bold**\n\n ```\n ```\n\nafter', text: '', language: null },
  { name: 'internal indentation', source: 'before **bold**\n\n  ~~~python\n  if ready:\n      print("你好")\n  ~~~\n\nafter', text: 'if ready:\n    print("你好")', language: 'python' },
  { name: 'shorter closing-looking fence inside code', source: 'before **bold**\n\n````markdown\n```js\nconst value = 1;\n```\n````\n\nafter', text: '```js\nconst value = 1;\n```', language: 'markdown' },
  { name: 'blank lines and spaces', source: 'before **bold**\n\n ~~~\n one  \n\n   two\n\n ~~~\n\nafter', text: 'one  \n\n  two\n', language: null },
  { name: 'ordinary indented code', source: 'before **bold**\n\n    const value = 1;\n\nafter', text: 'const value = 1;', language: null },
  { name: 'content indented less than its backtick fence', source: 'before **bold**\n\n  ```\n one\ntwo\n    three\n  ```\n\nafter', text: 'one\ntwo\n  three', language: null },
  { name: 'backtick in tilde-fence info string', source: 'before **bold**\n\n ~~~~lang`value\n ~~~\n one\n ~~~~\n\nafter', text: '~~~\none', language: 'lang`value' },
  ...['```', '~~~'].map(fence => ({
    name: `four-space content fence inside indented ${fence}`,
    source: `before **bold**\n\n  ${fence}\n    ${fence}\n  keep me\n  ${fence}\n\nafter`,
    text: `  ${fence}\nkeep me`, language: null,
  })),
  { name: 'leading tilde in a language containing a backtick', source: 'before **bold**\n\n ~~~ ~name`\n code\n ~~~\n\nafter', text: 'code', language: '~name`' },
  ...[1, 2].map(count => ({
    name: `${count} literal backslashes in the language`,
    source: `before **bold**\n\n ~~~ lang${'\\'.repeat(count * 2)}+name\n code\n ~~~\n\nafter`,
    text: 'code', language: `lang${'\\'.repeat(count)}+name`,
  })),
  ...[['non-breaking space', '\u00a0'], ['em space', '\u2003'], ['tab', '\t']].map(([name, text]) => ({
    name: `single ${name} as code content`,
    source: `before **bold**\n\n \`\`\`\n${text}\n \`\`\`\n\nafter`, text, language: null,
  })),
  { name: 'Unicode separators within a Markdown code line', source: 'before **bold**\n\n ```\n before\u2028  middle\u2029  after\n ```\n\nafter', text: 'before\u2028  middle\u2029  after', language: null },
];
