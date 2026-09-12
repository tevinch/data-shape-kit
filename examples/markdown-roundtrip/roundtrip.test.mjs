import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { Marked } from "marked";

const root = path.dirname(fileURLToPath(import.meta.url));
const localNodeModules = `${path.join(root, "node_modules")}${path.sep}`;
const requestedMode = process.argv[2];
const modes = requestedMode ? [requestedMode] : ["esm", "cjs"];

if (modes.some(mode => !new Set(["esm", "cjs"]).has(mode))) {
  throw new Error("Usage: node roundtrip.test.mjs [esm|cjs]");
}

function assertLocalResolution(specifier, resolved) {
  const resolvedPath = resolved.startsWith("file:") ? fileURLToPath(resolved) : resolved;
  assert(
    resolvedPath.startsWith(localNodeModules),
    `${specifier} resolved outside the fixture installation: ${resolvedPath}`,
  );
}

async function loadTiptap(mode) {
  const specifiers = [
    "@tiptap/core",
    "@tiptap/extension-table",
    "@tiptap/markdown",
    "@tiptap/starter-kit",
  ];
  if (mode === "esm") {
    specifiers.forEach(specifier => assertLocalResolution(specifier, import.meta.resolve(specifier)));
    const [core, table, markdown, starterKit] = await Promise.all([
      import("@tiptap/core"),
      import("@tiptap/extension-table"),
      import("@tiptap/markdown"),
      import("@tiptap/starter-kit"),
    ]);
    return {
      Editor: core.Editor,
      MarkdownManager: markdown.MarkdownManager,
      StarterKit: starterKit.default,
      TableKit: table.TableKit,
    };
  }

  const require = createRequire(import.meta.url);
  specifiers.forEach(specifier => assertLocalResolution(specifier, require.resolve(specifier)));
  const core = require("@tiptap/core");
  const table = require("@tiptap/extension-table");
  const markdown = require("@tiptap/markdown");
  const starterKit = require("@tiptap/starter-kit");
  return {
    Editor: core.Editor,
    MarkdownManager: markdown.MarkdownManager,
    StarterKit: starterKit.default,
    TableKit: table.TableKit,
  };
}

const mark = (type, attrs) => ({ type, ...(attrs ? { attrs } : {}) });
const text = (value, marks) => ({ type: "text", text: value, ...(marks ? { marks } : {}) });
const paragraph = content => ({ type: "paragraph", ...(content.length ? { content } : {}) });
const doc = content => ({ type: "doc", content });
const codeText = value => text(value, [mark("code")]);
const tableCell = (content, type = "tableCell") => ({
  type,
  content: [paragraph(content)],
});
const tableRow = cells => ({ type: "tableRow", content: cells });
const tableDoc = rows => doc([{ type: "table", content: rows.map(tableRow) }]);

function normalizedAttrs(type, attrs) {
  if (!attrs) return undefined;
  if (type === "link") {
    return attrs.href === undefined ? undefined : { href: attrs.href };
  }
  const entries = Object.entries(attrs).filter(([key, value]) => {
    if (value === null || value === undefined) return false;
    if (["tableCell", "tableHeader"].includes(type) && key === "colspan" && value === 1) return false;
    if (["tableCell", "tableHeader"].includes(type) && key === "rowspan" && value === 1) return false;
    return true;
  });
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function normalizedMarks(marks = []) {
  return marks
    .map(current => ({
      type: current.type,
      ...(normalizedAttrs(current.type, current.attrs)
        ? { attrs: normalizedAttrs(current.type, current.attrs) }
        : {}),
    }))
    .sort((left, right) => left.type.localeCompare(right.type));
}

function normalizeNode(node) {
  const normalized = { type: node.type };
  const attrs = normalizedAttrs(node.type, node.attrs);
  if (attrs) normalized.attrs = attrs;
  if (node.type === "text") {
    normalized.text = node.text ?? "";
    const marks = normalizedMarks(node.marks);
    if (marks.length) normalized.marks = marks;
    return normalized;
  }

  if (node.content) {
    const content = node.content.map(normalizeNode);
    const merged = [];
    for (const child of content) {
      const previous = merged.at(-1);
      if (
        child.type === "text" &&
        previous?.type === "text" &&
        JSON.stringify(child.marks ?? []) === JSON.stringify(previous.marks ?? [])
      ) {
        previous.text += child.text;
      } else {
        merged.push(child);
      }
    }
    if (merged.length) normalized.content = merged;
  }
  return normalized;
}

function codeCase(name, content) {
  return { name, document: doc([paragraph(content)]) };
}

const codeCases = [
  codeCase("plain paragraph control", [text("plain text without marks")]),
  codeCase("ordinary inline code control", [codeText("hello")]),
  {
    name: "DOM-free escaped code HTML fallback",
    markdown: "<code>\\&#124;tick` &amp; &lt;x&gt;</code>",
    document: doc([paragraph([codeText("\\|tick` & <x>")])]),
  },
  {
    name: "DOM-free ordinary code HTML control",
    markdown: "<code>plain</code>",
    document: doc([paragraph([text("<code>plain</code>")])]),
  },
  {
    name: "DOM-free encoded-pipe code HTML control",
    markdown: "<code>plain&#124;value</code>",
    document: doc([paragraph([text("<code>plain&#124;value</code>")])]),
  },
  {
    name: "DOM-free ordinary HTML control",
    markdown: "<span>kept literally</span>",
    document: doc([paragraph([text("<span>kept literally</span>")])]),
  },
  {
    name: "DOM-free custom HTML control",
    markdown: "<my-widget>kept literally</my-widget>",
    document: doc([paragraph([text("<my-widget>kept literally</my-widget>")])]),
  },
  codeCase("one embedded backtick", [codeText("hello ` world")]),
  codeCase("mixed one-through-four backtick runs", [codeText("a ` b `` c ``` d ```` e")]),
  codeCase("sole one-backtick content", [codeText("`")]),
  codeCase("sole two-backtick content", [codeText("``")]),
  codeCase("leading backticks", [codeText("``leading")]),
  codeCase("trailing backticks", [codeText("trailing``")]),
  codeCase("backticks at both ends", [codeText("`middle``")]),
  codeCase("spaces at both ends", [codeText(" padded ")]),
  codeCase("interior repeated spaces", [codeText("two  spaces")]),
  codeCase("whitespace-only code", [codeText("   ")]),
  codeCase("adjacent unmarked text", [text("Press "), codeText("`"), text(" to open")]),
  codeCase("split nodes in one continuous code span", [
    codeText("a`"),
    codeText("b``"),
    codeText("c"),
  ]),
];

const slashRows = [
  tableRow([tableCell([text("slashes")], "tableHeader"), tableCell([text("value")], "tableHeader")]),
  ...Array.from({ length: 7 }, (_, count) =>
    tableRow([tableCell([text(String(count))]), tableCell([text(`${"\\".repeat(count)}|`)])]),
  ),
];

const codeSlashRows = [
  tableRow([tableCell([text("slashes")], "tableHeader"), tableCell([text("code")], "tableHeader")]),
  ...Array.from({ length: 7 }, (_, count) =>
    tableRow([tableCell([text(String(count))]), tableCell([codeText(`${"\\".repeat(count)}|tick\``)])]),
  ),
];

function escapedTickPrefixTableCase(name, codeContent) {
  return {
    name,
    document: tableDoc([
      [tableCell([text("content")], "tableHeader")],
      [tableCell([text("literal ` before "), codeText(codeContent)])],
    ]),
  };
}

const tableCases = [
  {
    name: "ordinary table control",
    document: tableDoc([
      [tableCell([text("Name")], "tableHeader"), tableCell([text("Value")], "tableHeader")],
      [tableCell([text("alpha")]), tableCell([text("beta")])],
    ]),
  },
  {
    name: "pipes at each position and repeated pipes",
    document: tableDoc([
      [tableCell([text("case")], "tableHeader"), tableCell([text("value")], "tableHeader")],
      [tableCell([text("leading")]), tableCell([text("|start")])],
      [tableCell([text("middle")]), tableCell([text("left|right")])],
      [tableCell([text("trailing")]), tableCell([text("end|")])],
      [tableCell([text("repeated")]), tableCell([text("a||b|||c")])],
    ]),
  },
  { name: "zero-through-six backslashes before a pipe", document: doc([{ type: "table", content: slashRows }]) },
  {
    name: "zero-through-six backslashes before a pipe in code",
    document: doc([{ type: "table", content: codeSlashRows }]),
  },
  {
    name: "formatting links code Unicode and multiple cells",
    document: tableDoc([
      [tableCell([text("kind")], "tableHeader"), tableCell([text("content")], "tableHeader")],
      [tableCell([text("marks")]), tableCell([
        text("bold", [mark("bold")]),
        text(" / "),
        text("italic", [mark("italic")]),
        text(" / "),
        text("link", [mark("link", { href: "https://example.com/a?x=1&y=2" })]),
      ])],
      [tableCell([text("Unicode")]), tableCell([text("雪だるま ☃️ café")])],
      [tableCell([text("code")]), tableCell([codeText("left|`right``")])],
    ]),
  },
  {
    name: "table code preserves edge and repeated spaces",
    document: tableDoc([
      [tableCell([text("kind")], "tableHeader"), tableCell([text("content")], "tableHeader")],
      [tableCell([text("edge")]), tableCell([codeText(" padded ")])],
      [tableCell([text("interior")]), tableCell([codeText("two  spaces")])],
      [tableCell([text("only")]), tableCell([codeText("   ")])],
    ]),
  },
  escapedTickPrefixTableCase(
    "escaped literal tick before code with repeated spaces",
    "two  spaces",
  ),
  escapedTickPrefixTableCase(
    "escaped literal tick before code with edge spaces",
    " padded ",
  ),
  escapedTickPrefixTableCase(
    "escaped literal tick before whitespace-only code",
    "   ",
  ),
  escapedTickPrefixTableCase(
    "escaped literal tick before code with odd-backslash pipe",
    "a\\|  b",
  ),
  {
    name: "HTML fallback preserves spaces entities markup and backticks",
    document: tableDoc([
      [tableCell([text("kind")], "tableHeader"), tableCell([text("content")], "tableHeader")],
      [tableCell([text("edge")]), tableCell([codeText(" \\|tick` &amp; <x> ")])],
      [tableCell([text("interior")]), tableCell([codeText("two  spaces \\\\\\| tail")])],
      [tableCell([text("trailing")]), tableCell([codeText(" \\\\\\\\\\|  ")])],
    ]),
  },
];

async function assertThreeRoundTrips(manager, current, expected, name) {
  assert.deepEqual(normalizeNode(current), expected, `${name}: starting document`);
  for (let pass = 1; pass <= 3; pass += 1) {
    const markdown = manager.serialize(current);
    current = manager.parse(markdown);
    assert.deepEqual(normalizeNode(current), expected, `${name}: pass ${pass}\n${markdown}`);
  }
}

function installDOMGlobals(window) {
  const keys = [
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
  for (const key of keys) {
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

async function runEditorIntegration(mode, api) {
  const dom = new JSDOM("<!doctype html><html><body><div id=editor></div></body></html>", {
    pretendToBeVisual: true,
  });
  const restore = installDOMGlobals(dom.window);
  try {
    const source = tableCases.find(current =>
      current.name === "HTML fallback preserves spaces entities markup and backticks"
    ).document;
    const editor = new api.Editor({
      element: dom.window.document.querySelector("#editor"),
      extensions: [api.StarterKit, api.TableKit],
      content: source,
    });
    try {
      const manager = new api.MarkdownManager({
        extensions: [api.StarterKit, api.TableKit],
        marked: new Marked(),
      });
      await assertThreeRoundTrips(
        manager,
        editor.getJSON(),
        normalizeNode(source),
        "Editor integration",
      );
    } finally {
      editor.destroy();
    }
  } finally {
    restore();
    dom.window.close();
  }
}

async function runMode(mode) {
  const api = await loadTiptap(mode);
  const failures = [];
  let passed = 0;

  for (const currentCase of [...codeCases, ...tableCases]) {
    const manager = new api.MarkdownManager({
      extensions: [api.StarterKit, api.TableKit],
      marked: new Marked(),
    });
    try {
      await assertThreeRoundTrips(
        manager,
        currentCase.markdown ? manager.parse(currentCase.markdown) : currentCase.document,
        normalizeNode(currentCase.document),
        currentCase.name,
      );
      passed += 1;
      console.log(`PASS [${mode}] ${currentCase.name}`);
    } catch (error) {
      failures.push(error);
      console.error(`FAIL [${mode}] ${currentCase.name}: ${error.message}`);
    }
  }

  try {
    await runEditorIntegration(mode, api);
    passed += 1;
    console.log(`PASS [${mode}] Editor integration`);
  } catch (error) {
    failures.push(error);
    console.error(`FAIL [${mode}] Editor integration: ${error.message}`);
  }

  console.log(`RESULT [${mode}] ${passed} passed, ${failures.length} failed`);
  return failures;
}

const failures = [];
for (const mode of modes) failures.push(...await runMode(mode));
if (failures.length) {
  throw new AggregateError(failures, `${failures.length} Markdown round-trip cases failed`);
}
