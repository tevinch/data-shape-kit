import { registerVisualLineBoundary } from "./visual-line-boundary.js";
import { createEditor, DecoratorNode, $getDocument, $createParagraphNode, $createTextNode, $getRoot, $getSelection, $isRangeSelection, DELETE_LINE_COMMAND, UNDO_COMMAND, REDO_COMMAND, HISTORY_PUSH_TAG } from "lexical";
import { registerPlainText } from "@lexical/plain-text";
import { registerRichText } from "@lexical/rich-text";
import { registerHistory, createEmptyHistoryState } from "@lexical/history";
class TokenNode extends DecoratorNode {
  static getType() {
    return "token";
  }
  static clone(node) {
    return new TokenNode(node.__key);
  }
  static importJSON() {
    return new TokenNode();
  }
  createDOM() {
    const e = $getDocument().createElement("span");
    e.className = "token";
    e.contentEditable = "false";
    e.textContent = "x\xB2";
    e.dataset.token = "true";
    return e;
  }
  updateDOM() {
    return false;
  }
  decorate() {
    return null;
  }
  isInline() {
    return true;
  }
  isIsolated() {
    return false;
  }
  getTextContent() {
    return "[equation]";
  }
  exportJSON() {
    return { ...super.exportJSON(), type: "token", version: 1 };
  }
}
const root = document.querySelector("#editor");
let editor, dispose = () => {
}, backward = false, operations = 0, history, keys, baseline = [];
function setup() {
  dispose();
  if (editor) editor.setRootElement(null);
  editor = createEditor({ namespace: "line-probe", nodes: [TokenNode], onError: (e) => {
    document.querySelector("#status").textContent = e.stack;
    throw e;
  } });
  editor.setRootElement(root);
  editor.setEditable(!document.querySelector("#readonly").checked);
  const rich = document.querySelector("#rich").checked;
  const removeText = rich ? registerRichText(editor) : registerPlainText(editor);
  history = createEmptyHistoryState();
  const removeHistory = registerHistory(editor, history, 0);
  const removeCandidate = document.querySelector("#candidate").checked ? registerVisualLineBoundary(editor) : () => {
  };
  const removeUpdate = editor.registerUpdateListener(() => report());
  dispose = () => {
    removeText();
    removeHistory();
    removeUpdate();
    removeCandidate();
  };
  reset(false);
}
function tree() {
  return $getRoot().getChildren().map((p) => p.getChildren().map((n) => ({ type: n.getType(), text: n.getTextContent(), key: n.getKey() })));
}
function report() {
  if (!editor) return;
  for (const id of ["delete", "undo", "redo"]) document.querySelector("#" + id).disabled = !editor.isEditable();
  const model = editor.getEditorState().read(() => {
    const s = $getSelection();
    return { tree: tree(), selection: $isRangeSelection(s) ? { anchor: { key: s.anchor.key, offset: s.anchor.offset, type: s.anchor.type }, focus: { key: s.focus.key, offset: s.focus.offset, type: s.focus.type } } : null };
  });
  const rect = (e) => {
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  };
  document.querySelector("#status").textContent = JSON.stringify({ backward, operations, editable: editor.isEditable(), rich: document.querySelector("#rich").checked, width: root.clientWidth, model, tokenRect: rect(root.querySelector(".token")), undoEntries: history.undoStack.length, baseline }, null, 2);
}
function reset(isBack) {
  backward = isBack;
  operations = 0;
  root.style.width = (isBack ? 220 : 190) + "px";
  document.querySelector("#width").value = isBack ? 220 : 190;
  editor.update(() => {
    const p = $createParagraphNode(), left = $createTextNode("alpha beta gamma delta "), token = new TokenNode(), right = $createTextNode((isBack ? "" : " ") + "epsilon zeta eta theta iota kappa");
    p.append(left, token, right);
    const tail = $createParagraphNode().append($createTextNode("Keep this paragraph."));
    $getRoot().clear().append(p, tail);
    keys = { left: left.getKey(), token: token.getKey(), right: right.getKey() };
    (isBack ? right : left).select(isBack ? 3 : 2, isBack ? 3 : 2);
    baseline = tree();
  }, { discrete: true, tag: HISTORY_PUSH_TAG });
  requestAnimationFrame(report);
}
document.querySelector("#forward").onclick = () => reset(false);
document.querySelector("#backward").onclick = () => reset(true);
for (const id of ["delete", "undo", "redo"]) {
  const b = document.querySelector("#" + id);
  b.onmousedown = (e) => e.preventDefault();
  b.onclick = () => {
    editor.dispatchCommand(id === "delete" ? DELETE_LINE_COMMAND : id === "undo" ? UNDO_COMMAND : REDO_COMMAND, id === "delete" ? backward : void 0);
    operations++;
    requestAnimationFrame(report);
  };
}
document.querySelector("#readonly").onchange = (e) => {
  editor.setEditable(!e.target.checked);
  report();
};
document.querySelector("#width").oninput = (e) => {
  root.style.width = e.target.value + "px";
  report();
};
document.querySelector("#rich").onchange = setup;
document.querySelector("#candidate").onchange = setup;
setup();
import { runMatrix } from "./checks.js";
const matrixButton = document.querySelector("#matrix");
matrixButton.disabled = false;
matrixButton.onclick = async () => {
  matrixButton.disabled = true;
  try {
    await runMatrix(document.querySelector("#results"));
  } finally {
    matrixButton.disabled = false;
  }
};
