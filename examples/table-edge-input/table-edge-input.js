/** Keep typed replacement of a leading table-edge range inside its first cell. */
export function registerTableEdgeInput(editor) {
  let disposed = false;
  const onBeforeInput = event => {
    if (event.inputType !== 'insertText' || event.isComposing ||
        typeof event.data !== 'string' || event.data.length === 0 ||
        event.defaultPrevented || event.isDefaultPrevented?.() ||
        editor.mode.isReadOnly()) return;

    const root = editor.getBody();
    if (!root?.isContentEditable || !editor.selection.isEditable()) return;
    const range = editor.selection.getRng();
    if (range.collapsed || !root.contains(range.startContainer) ||
        !root.contains(range.endContainer)) return;

    const end = range.endContainer.nodeType === 1
      ? range.endContainer : range.endContainer.parentElement;
    const cell = end?.closest('td,th');
    const table = cell?.closest('table');
    if (!table || table.rows[0]?.cells[0] !== cell || table.querySelector('td,th') !== cell ||
        table.parentElement?.closest('table') || table.caption ||
        table.closest('[data-mce-bogus="all"]') ||
        cell.closest('[contenteditable="false" i]') ||
        cell.querySelector('[contenteditable="false" i]')) return;

    const parent = table.parentNode;
    if (range.startContainer !== parent ||
        parent.childNodes[range.startOffset] !== table) return;

    // The excluded portion is only the table boundary, with no caption or other cell.
    const inside = range.cloneRange();
    inside.setStart(cell, 0);
    if (inside.collapsed) return;
    editor.selection.setRng(inside);
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    editor.off('beforeinput', onBeforeInput);
    editor.off('remove', dispose);
  };
  editor.on('beforeinput', onBeforeInput);
  editor.on('remove', dispose);
  return dispose;
}
