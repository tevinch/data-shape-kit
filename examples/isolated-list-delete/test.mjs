import assert from 'node:assert/strict'
import test, { after } from 'node:test'

import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  pretendToBeVisual: true,
})

for (const name of [
  'DOMParser',
  'Element',
  'HTMLElement',
  'MutationObserver',
  'Node',
  'Text',
]) {
  globalThis[name] = dom.window[name]
}
globalThis.document = dom.window.document
globalThis.getComputedStyle = dom.window.getComputedStyle
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: dom.window.navigator,
})
globalThis.window = dom.window

const [{ Editor, Node: TiptapNode }, { TextSelection }, starterKitModule] =
  await Promise.all([
    import('@tiptap/core'),
    import('@tiptap/pm/state'),
    import('@tiptap/starter-kit'),
  ])
const StarterKit = starterKitModule.default ?? starterKitModule.StarterKit

const original = process.argv.includes('--original')
const IsolatedListDelete = original
  ? null
  : (await import('./isolated-list-delete.mjs')).IsolatedListDelete

const editors = new Set()

const Frame = TiptapNode.create({
  name: 'frame',
  group: 'block',
  content: 'block+',
  isolating: true,
  addAttributes() {
    return { id: { default: null } }
  },
  parseHTML() {
    return [{ tag: 'section[data-frame]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['section', { ...HTMLAttributes, 'data-frame': '' }, 0]
  },
})

const Page = TiptapNode.create({
  name: 'page',
  group: 'block',
  content: 'frame+',
  parseHTML() {
    return [{ tag: 'main[data-page]' }]
  },
  renderHTML() {
    return ['main', { 'data-page': '' }, 0]
  },
})

const Wrapper = TiptapNode.create({
  name: 'wrapper',
  group: 'block',
  content: 'block+',
  parseHTML() {
    return [{ tag: 'div[data-wrapper]' }]
  },
  renderHTML() {
    return ['div', { 'data-wrapper': '' }, 0]
  },
})

const InnerIsolating = TiptapNode.create({
  name: 'innerIsolating',
  group: 'block',
  content: 'block+',
  isolating: true,
  parseHTML() {
    return [{ tag: 'aside[data-inner-isolating]' }]
  },
  renderHTML() {
    return ['aside', { 'data-inner-isolating': '' }, 0]
  },
})

const AttributedParagraph = TiptapNode.create({
  name: 'paragraph',
  group: 'block',
  content: 'inline*',
  addAttributes() {
    return { kind: { default: null } }
  },
  parseHTML() {
    return [{ tag: 'p' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['p', HTMLAttributes, 0]
  },
})

const IsolatingOrderedList = TiptapNode.create({
  name: 'orderedList',
  group: 'block',
  content: 'listItem+',
  isolating: true,
  addAttributes() {
    return {
      start: { default: 1 },
      type: { default: null },
    }
  },
  parseHTML() {
    return [{ tag: 'ol' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['ol', HTMLAttributes, 0]
  },
})

const IsolatingListItem = TiptapNode.create({
  name: 'listItem',
  content: 'paragraph block*',
  defining: true,
  isolating: true,
  parseHTML() {
    return [{ tag: 'li' }]
  },
  renderHTML() {
    return ['li', 0]
  },
})

const IsolatingParagraph = TiptapNode.create({
  name: 'paragraph',
  group: 'block',
  content: 'inline*',
  isolating: true,
  parseHTML() {
    return [{ tag: 'p' }]
  },
  renderHTML() {
    return ['p', 0]
  },
})

function createEditor(
  content,
  {
    documentContent = 'block+',
    attributedParagraph = false,
    isolatingListItem = false,
    isolatingOrderedList = false,
    isolatingParagraph = false,
  } = {},
) {
  assert.equal(
    attributedParagraph && isolatingParagraph,
    false,
    'select only one custom paragraph schema',
  )
  const TestDocument = TiptapNode.create({
    name: 'doc',
    topNode: true,
    content: documentContent,
  })
  const editor = new Editor({
    element: document.body.appendChild(document.createElement('div')),
    extensions: [
      StarterKit.configure({
        document: false,
        trailingNode: false,
        ...((attributedParagraph || isolatingParagraph)
          ? { paragraph: false }
          : {}),
        ...(isolatingListItem ? { listItem: false } : {}),
        ...(isolatingOrderedList ? { orderedList: false } : {}),
      }),
      TestDocument,
      ...(attributedParagraph ? [AttributedParagraph] : []),
      ...(isolatingParagraph ? [IsolatingParagraph] : []),
      ...(isolatingListItem ? [IsolatingListItem] : []),
      ...(isolatingOrderedList ? [IsolatingOrderedList] : []),
      Frame,
      Page,
      Wrapper,
      InnerIsolating,
      ...(IsolatedListDelete ? [IsolatedListDelete] : []),
    ],
    content,
    injectCSS: false,
  })
  editors.add(editor)
  return editor
}

function textblockEnd(doc, text) {
  let found
  doc.descendants((node, pos) => {
    if (found === undefined && node.isTextblock && node.textContent === text) {
      found = pos + 1 + node.content.size
      return false
    }
    return true
  })
  assert.notEqual(found, undefined, `textblock ${JSON.stringify(text)} exists`)
  return found
}

function setTextSelection(editor, from, to = from) {
  editor.view.dispatch(
    editor.state.tr.setSelection(TextSelection.create(editor.state.doc, from, to)),
  )
}

function pressDelete(editor) {
  const event = new window.KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    code: 'Delete',
    key: 'Delete',
    keyCode: 46,
    which: 46,
  })
  return Boolean(
    editor.view.someProp('handleKeyDown', handler => handler(editor.view, event)),
  )
}

function json(editor) {
  return JSON.parse(JSON.stringify(editor.getJSON()))
}

function runIsolatedHandler(editor) {
  const extension = editor.extensionManager.extensions.find(
    candidate => candidate.name === 'isolatedListDelete',
  )
  assert.ok(extension)
  const shortcuts = extension.config.addKeyboardShortcuts.call(extension)
  return shortcuts.Delete({ editor })
}

function frame(id, content) {
  return { type: 'frame', attrs: { id }, content }
}

function paragraph(textOrContent = '') {
  if (Array.isArray(textOrContent)) {
    return { type: 'paragraph', content: textOrContent }
  }
  return textOrContent === ''
    ? { type: 'paragraph' }
    : { type: 'paragraph', content: [{ type: 'text', text: textOrContent }] }
}

function list(type, items) {
  return {
    type,
    ...(type === 'orderedList' ? { attrs: { start: 1, type: null } } : {}),
    content: items.map(blocks => ({ type: 'listItem', content: blocks })),
  }
}

after(() => {
  for (const editor of editors) editor.destroy()
  dom.window.close()
})

const originalFixture = {
  type: 'doc',
  content: [
    frame('first', [list('orderedList', [[paragraph('A')]]), paragraph('B')]),
    frame('second', [paragraph('C')]),
  ],
}

if (original) {
  test('stable ListKeymap corrupts the two-frame fixture without the extension', () => {
    const editor = createEditor(originalFixture)
    const originalSecond = editor.state.doc.child(1).toJSON()
    setTextSelection(editor, textblockEnd(editor.state.doc, 'A'))

    pressDelete(editor)

    const first = editor.state.doc.child(0)
    assert.equal(first.childCount, 1, JSON.stringify(json(editor)))
    assert.equal(first.firstChild.childCount, 1)
    assert.equal(first.firstChild.firstChild.textContent, 'AB')
    const second = editor.state.doc.child(1)
    assert.deepEqual(second.toJSON(), originalSecond)
  })
} else {
  test('merges the following paragraph into the final ordered-list item and preserves the next frame', () => {
    const editor = createEditor(originalFixture)
    const originalSecond = editor.state.doc.child(1).toJSON()
    const caret = textblockEnd(editor.state.doc, 'A')
    setTextSelection(editor, caret)

    assert.equal(pressDelete(editor), true)

    const first = editor.state.doc.child(0)
    const second = editor.state.doc.child(1)
    assert.equal(first.childCount, 1)
    assert.equal(first.firstChild.childCount, 1)
    assert.equal(first.firstChild.firstChild.textContent, 'AB')
    assert.deepEqual(second.toJSON(), originalSecond)
    assert.equal(editor.state.selection.from, caret)
    assert.equal(editor.state.selection.to, caret)
  })

  test('merges a following paragraph into a bullet list', () => {
    const input = {
      type: 'doc',
      content: [
        frame('one', [list('bulletList', [[paragraph('A')]]), paragraph('B')]),
      ],
    }
    const editor = createEditor(input)
    setTextSelection(editor, textblockEnd(editor.state.doc, 'A'))

    assert.equal(pressDelete(editor), true)
    assert.deepEqual(json(editor), {
      type: 'doc',
      content: [frame('one', [list('bulletList', [[paragraph('AB')]])])],
    })
  })

  test('removes an empty following paragraph without crossing the frame boundary', () => {
    const input = {
      type: 'doc',
      content: [
        frame('one', [list('orderedList', [[paragraph('A')]]), paragraph()]),
        frame('two', [paragraph('C')]),
      ],
    }
    const editor = createEditor(input)
    const second = JSON.parse(JSON.stringify(editor.state.doc.child(1).toJSON()))
    setTextSelection(editor, textblockEnd(editor.state.doc, 'A'))

    assert.equal(pressDelete(editor), true)
    assert.deepEqual(json(editor), {
      type: 'doc',
      content: [
        frame('one', [list('orderedList', [[paragraph('A')]])]),
        second,
      ],
    })
  })

  test('preserves marks and a hard break from the appended inline fragment', () => {
    const following = paragraph([
      { type: 'text', marks: [{ type: 'bold' }], text: 'B' },
      { type: 'hardBreak' },
      { type: 'text', marks: [{ type: 'italic' }], text: 'C' },
    ])
    const editor = createEditor({
      type: 'doc',
      content: [frame('one', [list('orderedList', [[paragraph('A')]]), following])],
    })
    setTextSelection(editor, textblockEnd(editor.state.doc, 'A'))

    assert.equal(pressDelete(editor), true)
    assert.deepEqual(json(editor), {
      type: 'doc',
      content: [
        frame('one', [
          list('orderedList', [
            [
              paragraph([
                { type: 'text', text: 'A' },
                { type: 'text', marks: [{ type: 'bold' }], text: 'B' },
                { type: 'hardBreak' },
                { type: 'text', marks: [{ type: 'italic' }], text: 'C' },
              ]),
            ],
          ]),
        ]),
      ],
    })
  })

  test('keeps preceding list items unchanged when merging from the final item', () => {
    const editor = createEditor({
      type: 'doc',
      content: [
        frame('one', [
          list('orderedList', [[paragraph('X')], [paragraph('A')]]),
          paragraph('B'),
        ]),
      ],
    })
    setTextSelection(editor, textblockEnd(editor.state.doc, 'A'))

    assert.equal(pressDelete(editor), true)
    assert.deepEqual(json(editor), {
      type: 'doc',
      content: [
        frame('one', [
          list('orderedList', [[paragraph('X')], [paragraph('AB')]]),
        ]),
      ],
    })
  })

  test('leaves an internal list-item join to stable ListKeymap behavior', () => {
    const input = {
      type: 'doc',
      content: [
        frame('one', [
          list('orderedList', [[paragraph('A')], [paragraph('B')]]),
          paragraph('C'),
        ]),
      ],
    }
    const editor = createEditor(input)
    setTextSelection(editor, textblockEnd(editor.state.doc, 'A'))

    assert.equal(pressDelete(editor), true)
    assert.deepEqual(json(editor), {
      type: 'doc',
      content: [
        frame('one', [
          list('orderedList', [[paragraph('AB')]]),
          paragraph('C'),
        ]),
      ],
    })
  })

  test('keeps the current paragraph attributes while appending inline content', () => {
    const current = {
      type: 'paragraph',
      attrs: { kind: 'lead' },
      content: [{ type: 'text', text: 'A' }],
    }
    const following = {
      type: 'paragraph',
      attrs: { kind: 'discarded-with-wrapper' },
      content: [{ type: 'text', text: 'B' }],
    }
    const editor = createEditor(
      {
        type: 'doc',
        content: [
          frame('one', [list('orderedList', [[current]]), following]),
        ],
      },
      { attributedParagraph: true },
    )
    setTextSelection(editor, textblockEnd(editor.state.doc, 'A'))

    assert.equal(pressDelete(editor), true)
    assert.deepEqual(json(editor), {
      type: 'doc',
      content: [
        frame('one', [
          list('orderedList', [
            [
              {
                type: 'paragraph',
                attrs: { kind: 'lead' },
                content: [{ type: 'text', text: 'AB' }],
              },
            ],
          ]),
        ]),
      ],
    })
  })

  test('appends to the final paragraph of a multi-paragraph final list item', () => {
    const editor = createEditor({
      type: 'doc',
      content: [
        frame('one', [
          list('orderedList', [[paragraph('intro'), paragraph('A')]]),
          paragraph('B'),
        ]),
      ],
    })
    setTextSelection(editor, textblockEnd(editor.state.doc, 'A'))

    assert.equal(pressDelete(editor), true)
    assert.deepEqual(json(editor), {
      type: 'doc',
      content: [
        frame('one', [
          list('orderedList', [[paragraph('intro'), paragraph('AB')]]),
        ]),
      ],
    })
  })

  test('finds the nearest isolating frame under doc and page nodes', () => {
    const input = {
      type: 'doc',
      content: [
        {
          type: 'page',
          content: [
            frame('one', [list('orderedList', [[paragraph('A')]]), paragraph('B')]),
            frame('two', [paragraph('C')]),
          ],
        },
      ],
    }
    const editor = createEditor(input, { documentContent: 'page+' })
    const second = JSON.parse(
      JSON.stringify(editor.state.doc.firstChild.child(1).toJSON()),
    )
    setTextSelection(editor, textblockEnd(editor.state.doc, 'A'))

    assert.equal(pressDelete(editor), true)
    assert.deepEqual(json(editor), {
      type: 'doc',
      content: [
        {
          type: 'page',
          content: [
            frame('one', [list('orderedList', [[paragraph('AB')]])]),
            second,
          ],
        },
      ],
    })
  })

  test('merges siblings inside a non-isolating wrapper within the frame', () => {
    const editor = createEditor({
      type: 'doc',
      content: [
        frame('one', [
          {
            type: 'wrapper',
            content: [list('bulletList', [[paragraph('A')]]), paragraph('B')],
          },
        ]),
      ],
    })
    setTextSelection(editor, textblockEnd(editor.state.doc, 'A'))

    assert.equal(pressDelete(editor), true)
    assert.deepEqual(json(editor), {
      type: 'doc',
      content: [
        frame('one', [
          {
            type: 'wrapper',
            content: [list('bulletList', [[paragraph('AB')]])],
          },
        ]),
      ],
    })
  })

  test('protects the next frame when the list ends its frame', () => {
    const input = {
      type: 'doc',
      content: [
        frame('one', [list('orderedList', [[paragraph('A')]])]),
        frame('two', [paragraph('B')]),
      ],
    }
    const editor = createEditor(input)
    setTextSelection(editor, textblockEnd(editor.state.doc, 'A'))

    assert.equal(pressDelete(editor), true)
    assert.deepEqual(json(editor), input)
  })

  test('protects an adjacent inner isolating block', () => {
    const input = {
      type: 'doc',
      content: [
        frame('one', [
          list('orderedList', [[paragraph('A')]]),
          { type: 'innerIsolating', content: [paragraph('B')] },
        ]),
      ],
    }
    const editor = createEditor(input)
    setTextSelection(editor, textblockEnd(editor.state.doc, 'A'))

    assert.equal(pressDelete(editor), true)
    assert.deepEqual(json(editor), input)
  })

  test('protects a following paragraph outside an isolating ordered list', () => {
    const input = {
      type: 'doc',
      content: [
        frame('one', [list('orderedList', [[paragraph('A')]]), paragraph('B')]),
      ],
    }
    const editor = createEditor(input, { isolatingOrderedList: true })
    setTextSelection(editor, textblockEnd(editor.state.doc, 'A'))

    assert.equal(pressDelete(editor), true)
    assert.deepEqual(json(editor), input)
  })

  test('protects a following paragraph outside an isolating list item', () => {
    const input = {
      type: 'doc',
      content: [
        frame('one', [list('orderedList', [[paragraph('A')]]), paragraph('B')]),
      ],
    }
    const editor = createEditor(input, { isolatingListItem: true })
    setTextSelection(editor, textblockEnd(editor.state.doc, 'A'))

    assert.equal(pressDelete(editor), true)
    assert.deepEqual(json(editor), input)
  })

  test('protects a following paragraph outside an isolating current paragraph', () => {
    const input = {
      type: 'doc',
      content: [
        frame('one', [list('orderedList', [[paragraph('A')]]), paragraph('B')]),
      ],
    }
    const editor = createEditor(input, { isolatingParagraph: true })
    setTextSelection(editor, textblockEnd(editor.state.doc, 'A'))

    assert.equal(pressDelete(editor), true)
    assert.deepEqual(json(editor), input)
  })

  test('protects an isolating following paragraph after a non-isolating final heading', () => {
    const input = {
      type: 'doc',
      content: [
        frame('one', [
          list('orderedList', [
            [
              paragraph('intro'),
              {
                type: 'heading',
                attrs: { level: 2 },
                content: [{ type: 'text', text: 'A' }],
              },
            ],
          ]),
          paragraph('B'),
        ]),
      ],
    }
    const editor = createEditor(input, { isolatingParagraph: true })
    setTextSelection(editor, textblockEnd(editor.state.doc, 'A'))

    assert.equal(pressDelete(editor), true)
    assert.deepEqual(json(editor), input)
  })

  test('leaves ordinary editing outside isolating containers to existing handlers', () => {
    const input = {
      type: 'doc',
      content: [list('orderedList', [[paragraph('A')]]), paragraph('B')],
    }
    const editor = createEditor(input)
    setTextSelection(editor, textblockEnd(editor.state.doc, 'A'))

    assert.equal(pressDelete(editor), true)
    assert.deepEqual(json(editor), {
      type: 'doc',
      content: [
        list('orderedList', [[paragraph('A')], [paragraph('B')]]),
      ],
    })
  })

  test('leaves a noncollapsed text selection to the existing delete handler', () => {
    const input = {
      type: 'doc',
      content: [
        frame('one', [list('orderedList', [[paragraph('AB')]]), paragraph('C')]),
      ],
    }
    const editor = createEditor(input)
    const end = textblockEnd(editor.state.doc, 'AB')
    setTextSelection(editor, end - 1, end)

    assert.equal(pressDelete(editor), true)
    assert.deepEqual(json(editor), {
      type: 'doc',
      content: [
        frame('one', [list('orderedList', [[paragraph('A')]]), paragraph('C')]),
      ],
    })
  })

  test('returns native fallback when the cursor is in the middle of text', () => {
    const input = {
      type: 'doc',
      content: [
        frame('one', [list('orderedList', [[paragraph('AB')]]), paragraph('C')]),
      ],
    }
    const editor = createEditor(input)
    setTextSelection(editor, textblockEnd(editor.state.doc, 'AB') - 1)

    assert.equal(runIsolatedHandler(editor), false)
    assert.deepEqual(json(editor), input)
  })

  test('returns native fallback for an incompatible following heading', () => {
    const input = {
      type: 'doc',
      content: [
        frame('one', [
          list('orderedList', [[paragraph('A')]]),
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'B' }] },
        ]),
      ],
    }
    const editor = createEditor(input)
    setTextSelection(editor, textblockEnd(editor.state.doc, 'A'))

    assert.equal(runIsolatedHandler(editor), false)
    assert.deepEqual(json(editor), input)
  })

  test('undo and redo restore the exact documents around one merge transaction', () => {
    const editor = createEditor(originalFixture)
    const before = json(editor)
    const caret = textblockEnd(editor.state.doc, 'A')
    setTextSelection(editor, caret)

    assert.equal(pressDelete(editor), true)
    const afterMerge = json(editor)
    assert.deepEqual(afterMerge, {
      type: 'doc',
      content: [
        frame('first', [list('orderedList', [[paragraph('AB')]])]),
        frame('second', [paragraph('C')]),
      ],
    })

    assert.equal(editor.commands.undo(), true)
    assert.deepEqual(json(editor), before)
    assert.equal(editor.commands.redo(), true)
    assert.deepEqual(json(editor), afterMerge)
  })
}
