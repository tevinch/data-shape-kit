import { Extension } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import { joinPoint } from '@tiptap/pm/transform'

const LIST_NAMES = new Set(['bulletList', 'orderedList'])

function findContext($from) {
  let itemDepth = null

  for (let depth = $from.depth - 1; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'listItem') {
      itemDepth = depth
      break
    }
  }

  if (itemDepth === null || itemDepth < 2) return null

  const listDepth = itemDepth - 1
  const list = $from.node(listDepth)
  const item = $from.node(itemDepth)

  if (!LIST_NAMES.has(list.type.name)) return null
  if ($from.index(listDepth) !== list.childCount - 1) return null
  if ($from.index(itemDepth) !== item.childCount - 1) return null
  if (item.lastChild !== $from.parent) return null

  let isolatingDepth = null
  for (let depth = itemDepth - 1; depth > 0; depth -= 1) {
    if ($from.node(depth).type.spec.isolating) {
      isolatingDepth = depth
      break
    }
  }

  if (isolatingDepth === null) return null

  return { isolatingDepth, listDepth }
}

function crossesIsolatingBoundary(state, $from, isolatingDepth) {
  const point = joinPoint(state.doc, $from.pos, 1)
  if (point === null || point === undefined) return false

  if (point >= $from.after(isolatingDepth)) return true

  const $point = state.doc.resolve(point)
  return Boolean(
    $point.nodeBefore?.type.spec.isolating ||
      $point.nodeAfter?.type.spec.isolating,
  )
}

function handleDelete(editor) {
  const { state } = editor
  const { selection } = state

  if (!selection.empty) return false

  const { $from } = selection
  if (!$from.parent.isTextblock) return false
  if ($from.parentOffset !== $from.parent.content.size) return false

  const context = findContext($from)
  if (!context) return false

  const parentDepth = context.listDepth - 1
  const parent = $from.node(parentDepth)
  const listIndex = $from.index(parentDepth)
  const following = parent.maybeChild(listIndex + 1)

  if (following?.type.name === 'paragraph') {
    const appended = $from.parent.content.append(following.content)

    if ($from.parent.type.validContent(appended)) {
      const caret = $from.pos
      const followingPos = $from.after(context.listDepth)
      const tr = state.tr.delete(
        followingPos,
        followingPos + following.nodeSize,
      )
      tr.insert(caret, following.content)
      tr.setSelection(TextSelection.create(tr.doc, caret))
      tr.scrollIntoView()

      editor.view.dispatch(tr)
      return true
    }
  }

  return crossesIsolatingBoundary(
    state,
    $from,
    context.isolatingDepth,
  )
}

export const IsolatedListDelete = Extension.create({
  name: 'isolatedListDelete',
  priority: 1000,

  addKeyboardShortcuts() {
    return {
      Delete: ({ editor }) => handleDelete(editor),
    }
  },
})
