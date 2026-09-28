import { createEditor, DecoratorNode, $getDocument, $createParagraphNode, $createTextNode, $getRoot, $getSelection, $setCompositionKey, getDOMSelection, COMMAND_PRIORITY_BEFORE_EDITOR, DELETE_LINE_COMMAND, UNDO_COMMAND, REDO_COMMAND, HISTORY_PUSH_TAG } from "lexical";
import { registerPlainText } from "@lexical/plain-text";
import { registerRichText } from "@lexical/rich-text";
import { registerHistory, createEmptyHistoryState } from "@lexical/history";
import { registerVisualLineBoundary } from "./visual-line-boundary.js";
const left = "alpha beta gamma delta ";
const right = "epsilon zeta eta theta iota kappa";
const tick = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const style = ".editor{font:16px/24px Arial;white-space:pre-wrap;overflow-wrap:break-word;border:1px solid;padding:0}.editor p{margin:0}.token{display:inline-block;white-space:nowrap;background:#ddd;padding:0 3px;font:inherit;border:0}.raised{transform:translateY(-30px)}";
function tree() {
  return $getRoot().getChildren().map((p) => p.getChildren().map((n) => [n.getType(), n.getTextContent()]));
}
function equal(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
async function one(options) {
  const { rich, backward, wide, button, space, realm, enabled, raised, guard, repeat, beforeTokenSpace } = options;
  const fixture = document.createElement("section");
  document.body.append(fixture);
  let host = fixture, doc = document;
  if (realm === "shadow") host = fixture.attachShadow({ mode: "open" });
  if (realm === "iframe") {
    const frame = document.createElement("iframe");
    frame.style.cssText = "width:1100px;height:170px";
    fixture.append(frame);
    doc = frame.contentDocument;
    host = doc.body;
  }
  const css = doc.createElement("style");
  css.textContent = style;
  host.append(css);
  const root = doc.createElement("div");
  root.className = "editor";
  root.contentEditable = "true";
  root.style.width = (wide ? 1e3 : backward ? 220 : beforeTokenSpace === false ? 185 : 190) + "px";
  host.append(root);
  class Token extends DecoratorNode {
    static getType() {
      return "token";
    }
    static clone(n) {
      return new Token(n.__key);
    }
    static importJSON() {
      return new Token();
    }
    createDOM() {
      const e = $getDocument().createElement(button ? "button" : "span");
      e.className = "token" + (raised ? " raised" : "");
      e.contentEditable = "false";
      e.textContent = "x\xB2";
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
      return guard === "isolated";
    }
    getTextContent() {
      return "[equation]";
    }
    exportJSON() {
      return { ...super.exportJSON(), type: "token", version: 1 };
    }
  }
  const calls = [], errors = [];
  const editor = createEditor({ namespace: "matrix", nodes: [Token], onError: (e) => errors.push(e.message) });
  editor.setRootElement(root);
  const removeMode = rich ? registerRichText(editor) : registerPlainText(editor);
  const history = createEmptyHistoryState();
  const removeHistory = registerHistory(editor, history, 0);
  let fallbackCalls = 0;
  const removeFallback = guard ? editor.registerCommand(DELETE_LINE_COMMAND, () => {
    fallbackCalls++;
    return true;
  }, COMMAND_PRIORITY_BEFORE_EDITOR) : () => {
  };
  const originalRegister = editor.registerCommand.bind(editor);
  editor.registerCommand = (command, listener, priority) => originalRegister(command, (payload) => {
    const handled = listener(payload);
    calls.push({ isBackward: payload, handled });
    return handled;
  }, priority);
  const removeCandidate = enabled ? registerVisualLineBoundary(editor) : () => {
  };
  editor.registerCommand = originalRegister;
  const leftText = beforeTokenSpace === false ? left.trimEnd() : left;
  const rightText = (space ? " " : "") + right;
  const offset = backward ? space ? 4 : 3 : 2;
  let before, leftKey, rightKey, leftEdgeLength;
  try {
    editor.update(() => {
      const a = $createTextNode(leftText), b = $createTextNode(rightText);
      const prefix = guard === "origin-transform" ? $createTextNode(leftText.slice(0, 6)).setStyle("color: rgb(10,20,30); transform: translateX(1px)") : null;
      if (prefix) a.setTextContent(leftText.slice(6));
      leftEdgeLength = a.getTextContentSize();
      leftKey = a.getKey();
      rightKey = b.getKey();
      $getRoot().clear().append($createParagraphNode().append(...(prefix ? [prefix, a] : [a]), new Token(), b), $createParagraphNode().append($createTextNode("Keep this paragraph.")));
      (backward ? b : prefix || a).select(offset, offset);
      before = tree();
    }, { discrete: true, tag: HISTORY_PUSH_TAG });
    await tick();
    const token = root.querySelector(".token");
    const edgeText = editor.getElementByKey(backward ? rightKey : leftKey).firstChild;
    const edgeOffset = backward ? space ? 1 : 0 : leftEdgeLength - 1;
    const edgeRange = doc.createRange();
    edgeRange.setStart(edgeText, edgeOffset);
    edgeRange.setEnd(edgeText, edgeOffset + 1);
    const edgeRect = edgeRange.getBoundingClientRect(), tokenRect = token.getBoundingClientRect();
    const separate = edgeRect.bottom <= tokenRect.top || tokenRect.bottom <= edgeRect.top;
    const geometry = { width: root.clientWidth, tokenTop: tokenRect.top, tokenBottom: tokenRect.bottom, edgeTop: edgeRect.top, edgeBottom: edgeRect.bottom, separate };
    const layoutCorrect = raised || (wide ? !separate : separate);
    if (guard === "readonly") editor.setEditable(false);
    if (guard === "composition") editor.update(() => $setCompositionKey($getRoot().getFirstChild().getFirstChild().getKey()), { discrete: true });
    if (guard === "selection") editor.update(() => $getRoot().getFirstChild().getFirstChild().select(1, 5), { discrete: true });
    if (guard === "rtl") root.style.direction = "rtl";
    if (guard === "transform") token.style.transform = "translateY(30px)";
    if (guard === "foreign-selection") {
      const other = doc.createElement("div");
      other.textContent = "outside";
      host.append(other);
      getDOMSelection(doc.defaultView).collapse(other.firstChild, 2);
    }
    if (guard === "dispose") removeCandidate();
    editor.dispatchCommand(DELETE_LINE_COMMAND, backward);
    await tick();
    const after = editor.getEditorState().read(tree);
    if (guard) {
      const pass = errors.length === 0 && equal(after, before) && fallbackCalls === 1 && (guard === "dispose" ? calls.length === 0 : calls.length === 1 && calls[0].handled === false);
      return { options, pass, before, after, calls, fallbackCalls, errors };
    }
    let repeated, repeatCorrect = true;
    if (repeat) {
      editor.dispatchCommand(DELETE_LINE_COMMAND, backward);
      await tick();
      repeated = editor.getEditorState().read(tree);
      const expectedRepeated = [[["text", backward ? "ilon zeta eta theta iota kappa" : "aliota kappa"]], [["text", "Keep this paragraph."]]];
      editor.dispatchCommand(UNDO_COMMAND, void 0);
      await tick();
      const repeatUndo = editor.getEditorState().read(tree);
      editor.dispatchCommand(REDO_COMMAND, void 0);
      await tick();
      const repeatRedo = editor.getEditorState().read(tree);
      editor.dispatchCommand(UNDO_COMMAND, void 0);
      await tick();
      repeatCorrect = equal(repeated, expectedRepeated) && equal(repeatUndo, after) && equal(repeatRedo, repeated) && calls.length === 2 && calls[0].handled && !calls[1].handled;
    }
    const expected = wide ? [[["text", backward ? rightText.slice(offset) : leftText.slice(0, offset)]], [["text", "Keep this paragraph."]]] : [[["text", backward ? leftText : leftText.slice(0, offset)], ["token", "[equation]"], ["text", backward ? (space ? " " : "") + rightText.slice(offset) : rightText]], [["text", "Keep this paragraph."]]];
    editor.dispatchCommand(UNDO_COMMAND, void 0);
    await tick();
    const undone = editor.getEditorState().read(tree);
    editor.dispatchCommand(REDO_COMMAND, void 0);
    await tick();
    const redone = editor.getEditorState().read(tree);
    return { options, pass: layoutCorrect && repeatCorrect && (enabled ? equal(after, expected) : !equal(after, expected) && !after[0].some((n) => n[0] === "token")) && equal(undone, before) && equal(redone, after) && errors.length === 0, deleteCorrect: equal(after, expected), undoCorrect: equal(undone, before), redoCorrect: equal(redone, after), calls, geometry, layoutCorrect, before, after, repeated, repeatCorrect, expected, errors };
  } finally {
    removeFallback();
    removeCandidate();
    removeHistory();
    removeMode();
    editor.setRootElement(null);
    fixture.remove();
  }
}
async function runMatrix(output) {
  const results = [];
  const cases = [];
  for (const rich of [false, true]) for (const backward of [false, true]) for (const realm of ["document", "shadow", "iframe"]) cases.push({ rich, backward, realm, enabled: true, wide: false, button: false, space: !backward });
  for (const backward of [false, true]) for (const button of [false, true]) for (const space of [false, true]) cases.push({ rich: true, backward, button, space, realm: "document", enabled: true, wide: false });
  for (const backward of [false, true]) for (const raised of [false, true]) cases.push({ rich: true, backward, raised, space: !backward, realm: "document", enabled: true, wide: true });
  for (const backward of [false, true]) cases.push({ rich: true, backward, space: !backward, realm: "document", enabled: false, wide: false });
  for (const guard of ["readonly", "composition", "selection", "rtl", "transform", "foreign-selection", "isolated", "dispose", "origin-transform"]) cases.push({ rich: true, backward: false, space: true, realm: "document", enabled: true, guard });
  for (const backward of [false, true]) cases.push({ rich: true, backward, space: !backward, realm: "document", enabled: true, repeat: true });
  for (const button of [false, true]) cases.push({rich:true,backward:false,button,space:true,beforeTokenSpace:false,realm:"document",enabled:true});
  for (const item of cases) {
    try {
      results.push(await one(item));
    } catch (e) {
      results.push({ options: item, pass: false, error: e.stack });
    }
    output.textContent = JSON.stringify({ browser: navigator.userAgent, running: results.length < cases.length, total: cases.length, passed: results.filter((x) => x.pass).length, results }, null, 2);
  }
}
export {
  runMatrix
};
