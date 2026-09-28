import {
  $createRangeSelection,
  $getSelection,
  $getSelectionSlotFrame,
  $isDecoratorNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  COMMAND_PRIORITY_BEFORE_EDITOR,
  DELETE_LINE_COMMAND,
  getDOMSelection,
  getDOMSelectionRange,
  getNearestEditorFromDOMNode,
} from 'lexical';

function hasOrdinaryFlow(element, root, view) {
  for (let node = element; node; node = node.parentElement) {
    const css = view.getComputedStyle(node);
    if (css.direction !== 'ltr' || css.writingMode !== 'horizontal-tb' ||
        css.transform !== 'none' || css.translate !== 'none' ||
        css.rotate !== 'none' || css.scale !== 'none' ||
        css.verticalAlign !== 'baseline' || css.float !== 'none' ||
        !['static', 'relative'].includes(css.position) ||
        (css.position === 'relative' &&
          [css.top, css.bottom, css.left, css.right].some(value => !['auto', '0px'].includes(value)))) return false;
    if (node === root) return true;
  }
  return false;
}

/** Register before the usual line-delete handler. Returns its unregister function. */
export function registerVisualLineBoundary(editor) {
  return editor.registerCommand(DELETE_LINE_COMMAND, (isBackward) => {
    if (!editor.isEditable() || editor.isComposing()) return false;
    const selection = $getSelection();
    if (!$isRangeSelection(selection) || !selection.isCollapsed() ||
        selection.anchor.type !== 'text') return false;
    // Slot-hosted content has its own structural deletion rules in Lexical.
    if ($getSelectionSlotFrame(selection) !== null) return false;

    const anchorNode = selection.anchor.getNode();
    if (!$isTextNode(anchorNode) || anchorNode.isToken() || anchorNode.isSegmented()) return false;
    const root = editor.getRootElement();
    const view = root?.ownerDocument.defaultView;
    if (!root || !view) return false;
    const rootStyle = view.getComputedStyle(root);
    if (rootStyle.direction !== 'ltr' || rootStyle.writingMode !== 'horizontal-tb') return false;

    const domSelection = getDOMSelection(view);
    if (!domSelection || domSelection.rangeCount !== 1 || !domSelection.isCollapsed ||
        typeof domSelection.modify !== 'function') return false;
    const origin = getDOMSelectionRange(domSelection, root);
    if (!origin || !root.contains(origin.startContainer) ||
        getNearestEditorFromDOMNode(origin.startContainer) !== editor) return false;

    // Stale DOM/model selections must not be used to choose a deletion range.
    const originalPoint = $createRangeSelection();
    originalPoint.applyDOMRange(origin);
    if (originalPoint.anchor.key !== selection.anchor.key ||
        originalPoint.anchor.offset !== selection.anchor.offset) return false;

    let boundary;
    try {
      // Keep the native selection collapsed while measuring, as Lexical does.
      domSelection.modify('move', isBackward ? 'backward' : 'forward', 'lineboundary');
      boundary = getDOMSelectionRange(domSelection, root);
    } finally {
      domSelection.collapse(origin.startContainer, origin.startOffset);
    }
    if (!boundary || !root.contains(boundary.startContainer) ||
        boundary.startContainer.nodeType !== 3 ||
        getNearestEditorFromDOMNode(boundary.startContainer) !== editor) return false;

    const measured = $createRangeSelection();
    measured.applyDOMRange(boundary);
    const textNode = measured.anchor.getNode();
    if (measured.anchor.type !== 'text' || !$isTextNode(textNode) ||
        textNode.isToken() || textNode.isSegmented() ||
        textNode.getParent() !== anchorNode.getParent()) return false;
    const offset = measured.anchor.offset;
    if (offset !== (isBackward ? 0 : textNode.getTextContentSize())) return false;
    const neighbour = isBackward ? textNode.getPreviousSibling() : textNode.getNextSibling();
    if (!$isDecoratorNode(neighbour) || !neighbour.isInline() || neighbour.isIsolated()) return false;
    const element = editor.getElementByKey(neighbour.getKey());
    if (!element || !root.contains(element)) return false;

    // Reject layouts whose visible position can differ from normal line flow.
    if (!hasOrdinaryFlow(element, root, view) ||
        !hasOrdinaryFlow(boundary.startContainer.parentElement, root, view)) return false;

    // Compare an actual boundary character with the adjacent decorator.
    const text = boundary.startContainer;
    const position = boundary.startOffset;
    if ((isBackward && position >= text.length) || (!isBackward && position === 0)) return false;
    const character = root.ownerDocument.createRange();
    character.setStart(text, isBackward ? position : position - 1);
    character.setEnd(text, isBackward ? position + 1 : position);
    const edge = character.getBoundingClientRect();
    const decorator = element.getBoundingClientRect();
    if (!edge.height || !decorator.height ||
        !(edge.bottom <= decorator.top || decorator.bottom <= edge.top)) return false;

    const deletion = selection.clone();
    deletion.focus.set(measured.anchor.key, offset, 'text');
    if (deletion.isCollapsed() || deletion.isBackward() !== isBackward) return false;
    $setSelection(deletion);
    deletion.removeText();
    return true;
  }, COMMAND_PRIORITY_BEFORE_EDITOR);
}
