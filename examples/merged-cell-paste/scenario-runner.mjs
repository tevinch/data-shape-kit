import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const mode = process.argv[2];
const runnerRoot = path.dirname(fileURLToPath(import.meta.url));
const localNodeModules = `${path.join(runnerRoot, "node_modules")}${path.sep}`;

if (!new Set(["esm", "cjs", "tiptap"]).has(mode)) {
  throw new Error("Usage: node scenario-runner.mjs <esm|cjs|tiptap>");
}

function assertLocalResolutions(specifiers, resolve) {
  for (const specifier of specifiers) {
    const resolved = resolve(specifier);
    const resolvedPath = resolved.startsWith("file:") ? fileURLToPath(resolved) : resolved;
    assert(
      resolvedPath.startsWith(localNodeModules),
      `${specifier} resolved outside the runner installation: ${resolvedPath}`,
    );
  }
}

const lowerTwoByThree = `
  <table>
    <tr><td>a</td><td>b</td><td>c</td></tr>
    <tr><td>d</td><td>e</td><td>f</td></tr>
  </table>`;

const upperTwoByThree = `
  <table>
    <tr><td>A</td><td>B</td><td>C</td></tr>
    <tr><td>D</td><td>E</td><td>F</td></tr>
  </table>`;

const bottomRightRowspan = `
  <table>
    <tr><td>A</td><td>B</td><td rowspan="2">C</td></tr>
    <tr><td>D</td><td>E</td></tr>
  </table>`;

const expectedBottomRightRowspanDocument = {
  type: "doc",
  content: [
    {
      type: "table",
      content: [
        {
          type: "table_row",
          content: [
            cellJSON("A"),
            cellJSON("B"),
            cellJSON("C", { rowspan: 2 }),
          ],
        },
        {
          type: "table_row",
          content: [cellJSON("D"), cellJSON("E")],
        },
      ],
    },
  ],
};

function cellJSON(text, attrs = {}) {
  return {
    type: "table_cell",
    attrs: {
      colspan: attrs.colspan ?? 1,
      rowspan: attrs.rowspan ?? 1,
      colwidth: null,
    },
    content: [
      {
        type: "paragraph",
        ...(text ? { content: [{ type: "text", text }] } : {}),
      },
    ],
  };
}

function cell(text, options = {}) {
  return {
    type: options.type ?? "table_cell",
    text,
    colspan: options.colspan ?? 1,
    rowspan: options.rowspan ?? 1,
    segments: options.segments ?? (text ? [{ text, marks: [] }] : []),
  };
}

function describeTable(table) {
  return table.content.content.map((row) =>
    row.content.content.map((currentCell) => {
      const segments = [];
      currentCell.descendants((node) => {
        if (node.isText) {
          segments.push({
            text: node.text,
            marks: node.marks.map((mark) => mark.type.name),
          });
        }
      });
      return {
        type: currentCell.type.name,
        text: currentCell.textContent,
        colspan: currentCell.attrs.colspan,
        rowspan: currentCell.attrs.rowspan,
        segments,
      };
    }),
  );
}

function installDOMGlobals(window) {
  const globals = [
    "window",
    "document",
    "navigator",
    "Node",
    "HTMLElement",
    "getComputedStyle",
    "MutationObserver",
    "requestAnimationFrame",
    "cancelAnimationFrame",
  ];
  const previous = new Map();
  for (const key of globals) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    const value = ["getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"].includes(key)
      ? window[key].bind(window)
      : window[key];
    Object.defineProperty(globalThis, key, { value, configurable: true });
  }
  return () => {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  };
}

function assertTableState({ state, CellSelection, TableMap }, expected) {
  state.doc.check();
  const table = state.doc.firstChild;
  assert(table, `${expected.name}: table is missing`);
  const map = TableMap.get(table);
  assert.equal(map.problems, null, `${expected.name}: table map has problems`);
  assert.deepEqual(
    { width: map.width, height: map.height },
    expected.dimensions,
    `${expected.name}: dimensions`,
  );
  assert.deepEqual(describeTable(table), expected.rows, `${expected.name}: document content`);
  if (expected.document) {
    const serializableDocument = JSON.parse(JSON.stringify(state.doc.toJSON()));
    assert.deepEqual(serializableDocument, expected.document, `${expected.name}: exact document`);
  }
  assert(
    state.selection instanceof CellSelection,
    `${expected.name}: result must be a CellSelection`,
  );
  const tableStart = state.selection.$anchorCell.start(-1);
  const rect = map.rectBetween(
    state.selection.$anchorCell.pos - tableStart,
    state.selection.$headCell.pos - tableStart,
  );
  assert.deepEqual(
    { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
    expected.selection,
    `${expected.name}: selection rectangle`,
  );
}

async function loadProseMirror(runtimeMode) {
  if (runtimeMode === "esm") {
    assertLocalResolutions(
      ["prosemirror-model", "prosemirror-state", "prosemirror-tables"],
      (specifier) => import.meta.resolve(specifier),
    );
    const [model, state, tables] = await Promise.all([
      import("prosemirror-model"),
      import("prosemirror-state"),
      import("prosemirror-tables"),
    ]);
    return { ...model, ...state, ...tables };
  }
  const require = createRequire(import.meta.url);
  assertLocalResolutions(
    ["prosemirror-model", "prosemirror-state", "prosemirror-tables"],
    (specifier) => require.resolve(specifier),
  );
  return {
    ...require("prosemirror-model"),
    ...require("prosemirror-state"),
    ...require("prosemirror-tables"),
  };
}

async function runProseMirror(runtimeMode) {
  const {
    Schema,
    DOMParser,
    EditorState,
    TextSelection,
    CellSelection,
    TableMap,
    handlePaste,
    tableNodes,
  } = await loadProseMirror(runtimeMode);
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const schema = new Schema({
    nodes: {
      doc: { content: "block+" },
      paragraph: {
        content: "text*",
        group: "block",
        parseDOM: [{ tag: "p" }],
        toDOM() {
          return ["p", 0];
        },
      },
      text: { group: "inline" },
      ...tableNodes({ tableGroup: "block", cellContent: "paragraph+" }),
    },
    marks: {
      strong: {
        parseDOM: [{ tag: "strong" }, { tag: "b" }],
        toDOM() {
          return ["strong", 0];
        },
      },
    },
  });
  const parser = DOMParser.fromSchema(schema);

  const parseDocument = (html) => {
    const container = dom.window.document.createElement("div");
    container.innerHTML = html;
    return parser.parse(container);
  };
  const parseSlice = (html) => {
    const container = dom.window.document.createElement("div");
    container.innerHTML = html;
    return parser.parseSlice(container);
  };

  const paste = ({ target, source, selection }) => {
    const doc = parseDocument(target);
    const map = TableMap.get(doc.firstChild);
    const tableStart = 1;
    let initialSelection;
    if (selection.kind === "cursor") {
      initialSelection = TextSelection.create(
        doc,
        tableStart + map.map[selection.cell] + 2,
      );
    } else {
      initialSelection = CellSelection.create(
        doc,
        tableStart + map.map[selection.anchor],
        tableStart + map.map[selection.head],
      );
    }
    let state = EditorState.create({ doc, selection: initialSelection });
    let dispatches = 0;
    const view = {
      get state() {
        return state;
      },
      dispatch(transaction) {
        state = state.apply(transaction);
        dispatches += 1;
      },
    };
    const handled = handlePaste(view, new dom.window.Event("paste"), parseSlice(source));
    assert.equal(handled, true, "paste handler must accept table input");
    assert.equal(dispatches, 1, "paste handler must dispatch once");
    return state;
  };

  const cases = [
    {
      name: "plain unmerged 2x3 control",
      target: lowerTwoByThree,
      source: upperTwoByThree,
      selection: { kind: "cursor", cell: 0 },
      dimensions: { width: 3, height: 2 },
      rows: [
        [cell("A"), cell("B"), cell("C")],
        [cell("D"), cell("E"), cell("F")],
      ],
      resultSelection: { left: 0, top: 0, right: 3, bottom: 2 },
    },
    {
      name: "bottom-right grid slot covered by rowspan",
      target: lowerTwoByThree,
      source: bottomRightRowspan,
      selection: { kind: "cursor", cell: 0 },
      dimensions: { width: 3, height: 2 },
      rows: [
        [cell("A"), cell("B"), cell("C", { rowspan: 2 })],
        [cell("D"), cell("E")],
      ],
      document: expectedBottomRightRowspanDocument,
      resultSelection: { left: 0, top: 0, right: 3, bottom: 2 },
    },
    {
      name: "bottom-right grid slot covered by rowspan and colspan",
      target: lowerTwoByThree,
      source: `
        <table>
          <tr><td>A</td><td rowspan="2" colspan="2">B</td></tr>
          <tr><td>C</td></tr>
        </table>`,
      selection: { kind: "cursor", cell: 0 },
      dimensions: { width: 3, height: 2 },
      rows: [
        [cell("A"), cell("B", { rowspan: 2, colspan: 2 })],
        [cell("C")],
      ],
      resultSelection: { left: 0, top: 0, right: 3, bottom: 2 },
    },
    {
      name: "colspan-only bottom-right control",
      target: lowerTwoByThree,
      source: `
        <table>
          <tr><td>A</td><td>B</td><td>C</td></tr>
          <tr><td>D</td><td colspan="2">E</td></tr>
        </table>`,
      selection: { kind: "cursor", cell: 0 },
      dimensions: { width: 3, height: 2 },
      rows: [
        [cell("A"), cell("B"), cell("C")],
        [cell("D"), cell("E", { colspan: 2 })],
      ],
      resultSelection: { left: 0, top: 0, right: 3, bottom: 2 },
    },
    {
      name: "rowspan with explicit right cell keeps selection in pasted rectangle",
      target: `
        <table>
          <tr><td>u</td><td>v</td><td>x</td></tr>
          <tr><td>w</td><td>y</td><td>z</td></tr>
        </table>`,
      source: `
        <table>
          <tr><td rowspan="2">A</td><td>B</td></tr>
          <tr><td>C</td></tr>
        </table>`,
      selection: { kind: "cursor", cell: 0 },
      dimensions: { width: 3, height: 2 },
      rows: [
        [cell("A", { rowspan: 2 }), cell("B"), cell("x")],
        [cell("C"), cell("z")],
      ],
      resultSelection: { left: 0, top: 0, right: 2, bottom: 2 },
    },
    {
      name: "nonzero paste grows table and preserves surrounding cells",
      target: `
        <table>
          <tr><td>a</td><td>b</td></tr>
          <tr><td>c</td><td>d</td></tr>
        </table>`,
      source: upperTwoByThree,
      selection: { kind: "cursor", cell: 3 },
      dimensions: { width: 4, height: 3 },
      rows: [
        [cell("a"), cell("b"), cell(""), cell("")],
        [cell("c"), cell("A"), cell("B"), cell("C")],
        [cell(""), cell("D"), cell("E"), cell("F")],
      ],
      resultSelection: { left: 1, top: 1, right: 4, bottom: 3 },
    },
    {
      name: "full rectangle CellSelection accepts full source",
      target: lowerTwoByThree,
      source: upperTwoByThree,
      selection: { kind: "cells", anchor: 0, head: 5 },
      dimensions: { width: 3, height: 2 },
      rows: [
        [cell("A"), cell("B"), cell("C")],
        [cell("D"), cell("E"), cell("F")],
      ],
      resultSelection: { left: 0, top: 0, right: 3, bottom: 2 },
    },
    {
      name: "one-cell CellSelection clips source",
      target: lowerTwoByThree,
      source: upperTwoByThree,
      selection: { kind: "cells", anchor: 1, head: 1 },
      dimensions: { width: 3, height: 2 },
      rows: [
        [cell("a"), cell("A"), cell("c")],
        [cell("d"), cell("e"), cell("f")],
      ],
      resultSelection: { left: 1, top: 0, right: 2, bottom: 1 },
    },
    {
      name: "header cells and supported strong marks survive",
      target: `<table><tr><td>x</td><td>y</td></tr></table>`,
      source: `<table><tr><th>A <strong>bold</strong></th><th>B</th></tr></table>`,
      selection: { kind: "cursor", cell: 0 },
      dimensions: { width: 2, height: 1 },
      rows: [
        [
          cell("A bold", {
            type: "table_header",
            segments: [
              { text: "A ", marks: [] },
              { text: "bold", marks: ["strong"] },
            ],
          }),
          cell("B", { type: "table_header" }),
        ],
      ],
      resultSelection: { left: 0, top: 0, right: 2, bottom: 1 },
    },
  ];

  try {
    for (const current of cases) {
      const state = paste(current);
      assertTableState(
        { state, CellSelection, TableMap },
        {
          name: current.name,
          dimensions: current.dimensions,
          rows: current.rows,
          document: current.document,
          selection: current.resultSelection,
        },
      );
      console.log(`PASS [${runtimeMode}] ${current.name}`);
    }
    console.log(`PASS [${runtimeMode}] ${cases.length} ProseMirror scenarios`);
  } finally {
    dom.window.close();
  }
}

async function runTiptap() {
  const dom = new JSDOM(
    "<!doctype html><html><body><div id=editor></div></body></html>",
    { pretendToBeVisual: true },
  );
  const restoreGlobals = installDOMGlobals(dom.window);
  try {
    assertLocalResolutions(
      [
        "@tiptap/core",
        "@tiptap/extension-table",
        "@tiptap/extension-document",
        "@tiptap/extension-paragraph",
        "@tiptap/extension-text",
        "prosemirror-tables",
      ],
      (specifier) => import.meta.resolve(specifier),
    );
    const [core, tableExtension, documentExtension, paragraphExtension, textExtension, tables] =
      await Promise.all([
        import("@tiptap/core"),
        import("@tiptap/extension-table"),
        import("@tiptap/extension-document"),
        import("@tiptap/extension-paragraph"),
        import("@tiptap/extension-text"),
        import("prosemirror-tables"),
      ]);
    const { Editor } = core;
    const { TableKit } = tableExtension;
    const { Document } = documentExtension;
    const { Paragraph } = paragraphExtension;
    const { Text } = textExtension;
    const { CellSelection, TableMap } = tables;

    const cases = [
      { name: "plain control", source: upperTwoByThree },
      { name: "bare rowspan", source: bottomRightRowspan },
      {
        name: "wrapped rowspan with style element",
        source: `<google-sheets-html-origin><style>td { color: red }</style>${bottomRightRowspan}</google-sheets-html-origin>`,
      },
      {
        name: "unquoted rowspan attribute",
        source: `
          <table>
            <tr><td>A</td><td>B</td><td rowspan=2>C</td></tr>
            <tr><td>D</td><td>E</td></tr>
          </table>`,
      },
      { name: "repeated rowspan paste", source: bottomRightRowspan, repeat: true },
    ];

    for (const current of cases) {
      const element = dom.window.document.createElement("div");
      dom.window.document.body.append(element);
      const editor = new Editor({
        element,
        extensions: [Document, Paragraph, Text, TableKit],
        content: lowerTwoByThree,
      });
      try {
        editor.commands.setTextSelection(4);
        const handled = editor.view.pasteHTML(
          current.source,
          new dom.window.Event("paste"),
        );
        assert.equal(handled, true, `${current.name}: pasteHTML must report handled`);
        if (current.repeat) {
          const repeated = editor.view.pasteHTML(
            current.source,
            new dom.window.Event("paste"),
          );
          assert.equal(repeated, true, `${current.name}: second pasteHTML must report handled`);
        }
        const isPlain = current.name === "plain control";
        assertTableState(
          { state: editor.state, CellSelection, TableMap },
          {
            name: current.name,
            dimensions: { width: 3, height: 2 },
            rows: isPlain
              ? [
                  [cell("A", { type: "tableCell" }), cell("B", { type: "tableCell" }), cell("C", { type: "tableCell" })],
                  [cell("D", { type: "tableCell" }), cell("E", { type: "tableCell" }), cell("F", { type: "tableCell" })],
                ]
              : [
                  [cell("A", { type: "tableCell" }), cell("B", { type: "tableCell" }), cell("C", { type: "tableCell", rowspan: 2 })],
                  [cell("D", { type: "tableCell" }), cell("E", { type: "tableCell" })],
                ],
            selection: { left: 0, top: 0, right: 3, bottom: 2 },
          },
        );
        console.log(`PASS [tiptap] ${current.name}`);
      } finally {
        editor.destroy();
        element.remove();
      }
    }
    console.log(`PASS [tiptap] ${cases.length} Tiptap scenarios`);
  } finally {
    restoreGlobals();
    dom.window.close();
  }
}

if (mode === "tiptap") await runTiptap();
else await runProseMirror(mode);
