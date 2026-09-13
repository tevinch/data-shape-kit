import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

import JSZip from "jszip";
import xmlJs from "xml-js";
import * as esmDocx from "docx";

const require = createRequire(import.meta.url);
const cjsDocx = require("docx");
const { xml2js } = xmlJs;

const PNG_ORIGINAL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const PNG_REPLACEMENT = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2jQoAAAAASUVORK5CYII=",
  "base64",
);

function elements(node, name) {
  return (node?.elements ?? []).filter(child => child.type === "element" && child.name === name);
}

function firstElement(node, name) {
  return (node?.elements ?? []).find(child => child.type === "element" && child.name === name);
}

function descendants(node, name, found = []) {
  for (const child of node?.elements ?? []) {
    if (child.type !== "element") continue;
    if (child.name === name) found.push(child);
    descendants(child, name, found);
  }
  return found;
}

function textContent(node) {
  return (node?.elements ?? [])
    .map(child => (child.type === "text" ? String(child.text ?? "") : textContent(child)))
    .join("");
}

async function parsePart(zip, partName) {
  const part = zip.file(partName);
  assert(part, `expected ${partName} in DOCX archive`);
  return xml2js(await part.async("text"), { compact: false });
}

function rootElement(parsed, name) {
  const root = firstElement(parsed, name);
  assert(root, `expected ${name} XML root`);
  return root;
}

function directParagraphTexts(container) {
  return elements(container, "w:p").map(textContent);
}

function bodyElement(parsed) {
  return firstElement(rootElement(parsed, "w:document"), "w:body");
}

function tableShape(table) {
  return elements(table, "w:tr").map(row =>
    elements(row, "w:tc").map(cell =>
      (cell.elements ?? [])
        .filter(child => child.type === "element" && (child.name === "w:p" || child.name === "w:tbl"))
        .map(child =>
          child.name === "w:p" ? { type: "paragraph", text: textContent(child) } : {
            type: "table",
            rows: tableShape(child),
          },
        ),
    ),
  );
}

function bodyShape(body) {
  return (body.elements ?? [])
    .filter(child => child.type === "element" && (child.name === "w:p" || child.name === "w:tbl"))
    .map(child =>
      child.name === "w:p" ? { type: "paragraph", text: textContent(child) } : {
        type: "table",
        rows: tableShape(child),
      },
    );
}

function countText(items, expected) {
  return items.filter(item => item === expected).length;
}

function assertResolved(parsed, token) {
  assert.equal(textContent(parsed).includes(token), false, `${token} must be fully resolved`);
}

function paragraph(api, text) {
  return new api.Paragraph(text);
}

function oneCellTable(api, children) {
  return new api.Table({
    rows: [
      new api.TableRow({
        children: [new api.TableCell({ children })],
      }),
    ],
  });
}

async function patchFixture(api, { children, patches, recursive, placeholderDelimiters, headers, footers }) {
  const template = await api.Packer.toBuffer(
    new api.Document({
      sections: [
        {
          children,
          ...(headers ? { headers } : {}),
          ...(footers ? { footers } : {}),
        },
      ],
    }),
  );
  const output = await api.patchDocument({
    data: template,
    outputType: "nodebuffer",
    patches,
    ...(recursive === undefined ? {} : { recursive }),
    ...(placeholderDelimiters ? { placeholderDelimiters } : {}),
  });
  return JSZip.loadAsync(output);
}

function documentPatch(api, children) {
  return { type: api.PatchType.DOCUMENT, children };
}

function paragraphPatch(api, children) {
  return { type: api.PatchType.PARAGRAPH, children };
}

async function documentParagraphs(api, options) {
  const zip = await patchFixture(api, options);
  const parsed = await parsePart(zip, "word/document.xml");
  return { zip, parsed, body: bodyElement(parsed), texts: directParagraphTexts(bodyElement(parsed)) };
}

const scenarios = [
  ["replaces two separated DOCUMENT placeholders with multiple paragraphs", async api => {
    const result = await documentParagraphs(api, {
      children: [paragraph(api, "HEADING ONE"), paragraph(api, "{{ph}}"), paragraph(api, "HEADING TWO"), paragraph(api, "{{ph}}"), paragraph(api, "END")],
      patches: { ph: documentPatch(api, [paragraph(api, "INSERTED"), paragraph(api, "tail")]) },
    });
    assert.deepEqual(result.texts, ["HEADING ONE", "INSERTED", "tail", "HEADING TWO", "INSERTED", "tail", "END"]);
    assert.equal(countText(result.texts, "INSERTED"), 2);
    assertResolved(result.parsed, "{{ph}}");
  }],
  ["replaces three separated DOCUMENT placeholders exactly once", async api => {
    const result = await documentParagraphs(api, {
      children: [paragraph(api, "{{ph}}"), paragraph(api, "A"), paragraph(api, "{{ph}}"), paragraph(api, "B"), paragraph(api, "{{ph}}")],
      patches: { ph: documentPatch(api, [paragraph(api, "X"), paragraph(api, "Y")]) },
    });
    assert.deepEqual(result.texts, ["X", "Y", "A", "X", "Y", "B", "X", "Y"]);
    assert.equal(countText(result.texts, "X"), 3);
    assertResolved(result.parsed, "{{ph}}");
  }],
  ["replaces adjacent DOCUMENT placeholders without losing either replacement", async api => {
    const result = await documentParagraphs(api, {
      children: [paragraph(api, "BEFORE"), paragraph(api, "{{ph}}"), paragraph(api, "{{ph}}"), paragraph(api, "AFTER")],
      patches: { ph: documentPatch(api, [paragraph(api, "ONE"), paragraph(api, "TWO")]) },
    });
    assert.deepEqual(result.texts, ["BEFORE", "ONE", "TWO", "ONE", "TWO", "AFTER"]);
    assert.equal(countText(result.texts, "ONE"), 2);
    assertResolved(result.parsed, "{{ph}}");
  }],
  ["removes every repeated DOCUMENT placeholder when children is empty", async api => {
    const result = await documentParagraphs(api, {
      children: [paragraph(api, "{{ph}}"), paragraph(api, "KEEP A"), paragraph(api, "{{ph}}"), paragraph(api, "KEEP B"), paragraph(api, "{{ph}}")],
      patches: { ph: documentPatch(api, []) },
    });
    assert.deepEqual(result.texts, ["KEEP A", "KEEP B"]);
    assertResolved(result.parsed, "{{ph}}");
  }],
  ["replaces repeated DOCUMENT placeholders with one child", async api => {
    const result = await documentParagraphs(api, {
      children: [paragraph(api, "{{ph}}"), paragraph(api, "KEEP"), paragraph(api, "{{ph}}")],
      patches: { ph: documentPatch(api, [paragraph(api, "ONE")]) },
    });
    assert.deepEqual(result.texts, ["ONE", "KEEP", "ONE"]);
    assert.equal(countText(result.texts, "ONE"), 2);
    assertResolved(result.parsed, "{{ph}}");
  }],
  ["replaces repeated DOCUMENT placeholders with recursive false", async api => {
    const result = await documentParagraphs(api, {
      children: [paragraph(api, "{{ph}}"), paragraph(api, "MIDDLE"), paragraph(api, "{{ph}}")],
      patches: { ph: documentPatch(api, [paragraph(api, "X"), paragraph(api, "Y")]) },
      recursive: false,
    });
    assert.deepEqual(result.texts, ["X", "Y", "MIDDLE", "X", "Y"]);
    assert.equal(countText(result.texts, "X"), 2);
    assertResolved(result.parsed, "{{ph}}");
  }],
  ["replaces repeated DOCUMENT placeholders with recursive true", async api => {
    const result = await documentParagraphs(api, {
      children: [paragraph(api, "{{ph}}"), paragraph(api, "MIDDLE"), paragraph(api, "{{ph}}")],
      patches: { ph: documentPatch(api, [paragraph(api, "X"), paragraph(api, "Y"), paragraph(api, "Z")]) },
      recursive: true,
    });
    assert.deepEqual(result.texts, ["X", "Y", "Z", "MIDDLE", "X", "Y", "Z"]);
    assert.equal(countText(result.texts, "X"), 2);
    assertResolved(result.parsed, "{{ph}}");
  }],
  ["replaces repeated DOCUMENT placeholders with custom delimiters", async api => {
    const result = await documentParagraphs(api, {
      children: [paragraph(api, "[[ph]]"), paragraph(api, "MIDDLE"), paragraph(api, "[[ph]]")],
      patches: { ph: documentPatch(api, [paragraph(api, "CUSTOM"), paragraph(api, "tail")]) },
      placeholderDelimiters: { start: "[[", end: "]]" },
    });
    assert.deepEqual(result.texts, ["CUSTOM", "tail", "MIDDLE", "CUSTOM", "tail"]);
    assert.equal(countText(result.texts, "CUSTOM"), 2);
    assertResolved(result.parsed, "[[ph]]");
  }],
  ["finds repeated DOCUMENT placeholders split across formatted runs", async api => {
    const split = () => new api.Paragraph({
      children: [
        new api.TextRun({ text: "{{", bold: true }),
        new api.TextRun({ text: "ph", italics: true }),
        new api.TextRun({ text: "}}", color: "C00000" }),
      ],
    });
    const result = await documentParagraphs(api, {
      children: [split(), paragraph(api, "MIDDLE"), split()],
      patches: { ph: documentPatch(api, [paragraph(api, "SPLIT"), paragraph(api, "tail")]) },
    });
    assert.deepEqual(result.texts, ["SPLIT", "tail", "MIDDLE", "SPLIT", "tail"]);
    assert.equal(countText(result.texts, "SPLIT"), 2);
    assertResolved(result.parsed, "{{ph}}");
  }],
  ["replaces distinct DOCUMENT keys without shifting later key locations", async api => {
    const result = await documentParagraphs(api, {
      children: [paragraph(api, "{{alpha}}"), paragraph(api, "KEEP A"), paragraph(api, "{{beta}}"), paragraph(api, "KEEP B"), paragraph(api, "{{alpha}}"), paragraph(api, "{{beta}}")],
      patches: {
        alpha: documentPatch(api, [paragraph(api, "A1"), paragraph(api, "A2")]),
        beta: documentPatch(api, [paragraph(api, "B1"), paragraph(api, "B2"), paragraph(api, "B3")]),
      },
    });
    assert.deepEqual(result.texts, ["A1", "A2", "KEEP A", "B1", "B2", "B3", "KEEP B", "A1", "A2", "B1", "B2", "B3"]);
    assert.equal(countText(result.texts, "A1"), 2);
    assert.equal(countText(result.texts, "B1"), 2);
    assertResolved(result.parsed, "{{alpha}}");
    assertResolved(result.parsed, "{{beta}}");
  }],
  ["preserves a table sibling between repeated top-level placeholders", async api => {
    const result = await documentParagraphs(api, {
      children: [paragraph(api, "{{ph}}"), oneCellTable(api, [paragraph(api, "TABLE KEEP")]), paragraph(api, "{{ph}}")],
      patches: { ph: documentPatch(api, [paragraph(api, "X"), paragraph(api, "Y")]) },
    });
    assert.deepEqual(bodyShape(result.body), [
      { type: "paragraph", text: "X" },
      { type: "paragraph", text: "Y" },
      { type: "table", rows: [[[{ type: "paragraph", text: "TABLE KEEP" }]]] },
      { type: "paragraph", text: "X" },
      { type: "paragraph", text: "Y" },
    ]);
    assertResolved(result.parsed, "{{ph}}");
  }],
  ["replaces the same DOCUMENT key in different table cells", async api => {
    const table = new api.Table({
      rows: [new api.TableRow({ children: [
        new api.TableCell({ children: [paragraph(api, "{{ph}}"), paragraph(api, "LEFT KEEP")] }),
        new api.TableCell({ children: [paragraph(api, "RIGHT KEEP"), paragraph(api, "{{ph}}") ] }),
      ] })],
    });
    const result = await documentParagraphs(api, {
      children: [table],
      patches: { ph: documentPatch(api, [paragraph(api, "CELL X"), paragraph(api, "CELL Y")]) },
    });
    assert.deepEqual(tableShape(elements(result.body, "w:tbl")[0]), [[
      [{ type: "paragraph", text: "CELL X" }, { type: "paragraph", text: "CELL Y" }, { type: "paragraph", text: "LEFT KEEP" }],
      [{ type: "paragraph", text: "RIGHT KEEP" }, { type: "paragraph", text: "CELL X" }, { type: "paragraph", text: "CELL Y" }],
    ]]);
    assertResolved(result.parsed, "{{ph}}");
  }],
  ["preserves siblings around repeated placeholders in a nested table cell", async api => {
    const nested = oneCellTable(api, [paragraph(api, "{{ph}}"), paragraph(api, "NESTED KEEP"), paragraph(api, "{{ph}}")]);
    const outer = oneCellTable(api, [paragraph(api, "OUTER BEFORE"), nested, paragraph(api, "OUTER AFTER")]);
    const result = await documentParagraphs(api, {
      children: [outer],
      patches: { ph: documentPatch(api, [paragraph(api, "NEST X"), paragraph(api, "NEST Y")]) },
    });
    assert.deepEqual(tableShape(elements(result.body, "w:tbl")[0]), [[[
      { type: "paragraph", text: "OUTER BEFORE" },
      { type: "table", rows: [[[
        { type: "paragraph", text: "NEST X" },
        { type: "paragraph", text: "NEST Y" },
        { type: "paragraph", text: "NESTED KEEP" },
        { type: "paragraph", text: "NEST X" },
        { type: "paragraph", text: "NEST Y" },
      ]]] },
      { type: "paragraph", text: "OUTER AFTER" },
    ]]]);
    assertResolved(result.parsed, "{{ph}}");
  }],
  ["inserts replacement tables at every repeated DOCUMENT placeholder", async api => {
    const replacementTable = oneCellTable(api, [paragraph(api, "REPLACEMENT CELL")]);
    const result = await documentParagraphs(api, {
      children: [paragraph(api, "{{ph}}"), paragraph(api, "BETWEEN"), paragraph(api, "{{ph}}")],
      patches: { ph: documentPatch(api, [replacementTable]) },
    });
    assert.deepEqual(bodyShape(result.body), [
      { type: "table", rows: [[[{ type: "paragraph", text: "REPLACEMENT CELL" }]]] },
      { type: "paragraph", text: "BETWEEN" },
      { type: "table", rows: [[[{ type: "paragraph", text: "REPLACEMENT CELL" }]]] },
    ]);
    assert.equal(descendants(result.body, "w:tbl").length, 2);
    assertResolved(result.parsed, "{{ph}}");
  }],
  ["replaces repeated DOCUMENT placeholders in a header", async api => {
    const zip = await patchFixture(api, {
      children: [paragraph(api, "BODY")],
      headers: { default: new api.Header({ children: [paragraph(api, "{{ph}}"), paragraph(api, "HEADER KEEP"), paragraph(api, "{{ph}}") ] }) },
      patches: { ph: documentPatch(api, [paragraph(api, "HEADER X"), paragraph(api, "HEADER Y")]) },
    });
    const parsed = await parsePart(zip, "word/header1.xml");
    const header = rootElement(parsed, "w:hdr");
    assert.deepEqual(directParagraphTexts(header), ["HEADER X", "HEADER Y", "HEADER KEEP", "HEADER X", "HEADER Y"]);
    assertResolved(parsed, "{{ph}}");
  }],
  ["replaces repeated DOCUMENT placeholders in a footer", async api => {
    const zip = await patchFixture(api, {
      children: [paragraph(api, "BODY")],
      footers: { default: new api.Footer({ children: [paragraph(api, "{{ph}}"), paragraph(api, "FOOTER KEEP"), paragraph(api, "{{ph}}") ] }) },
      patches: { ph: documentPatch(api, [paragraph(api, "FOOTER X"), paragraph(api, "FOOTER Y")]) },
    });
    const parsed = await parsePart(zip, "word/footer1.xml");
    const footer = rootElement(parsed, "w:ftr");
    assert.deepEqual(directParagraphTexts(footer), ["FOOTER X", "FOOTER Y", "FOOTER KEEP", "FOOTER X", "FOOTER Y"]);
    assertResolved(parsed, "{{ph}}");
  }],
  ["preserves Unicode and paragraph and run formatting around replacements", async api => {
    const kept = new api.Paragraph({
      style: "Quote",
      children: [new api.TextRun({ text: "保留 café 🧩", italics: true })],
    });
    const inserted = new api.Paragraph({
      heading: api.HeadingLevel.HEADING_2,
      children: [new api.TextRun({ text: "插入 résumé 🌍", bold: true, color: "C00000" })],
    });
    const result = await documentParagraphs(api, {
      children: [paragraph(api, "{{ph}}"), kept, paragraph(api, "{{ph}}")],
      patches: { ph: documentPatch(api, [inserted, paragraph(api, "尾")]) },
    });
    assert.deepEqual(result.texts, ["插入 résumé 🌍", "尾", "保留 café 🧩", "插入 résumé 🌍", "尾"]);
    const paragraphs = elements(result.body, "w:p");
    for (const index of [0, 3]) {
      assert.equal(firstElement(firstElement(paragraphs[index], "w:pPr"), "w:pStyle")?.attributes?.["w:val"], "Heading2");
      assert(descendants(paragraphs[index], "w:b").length > 0, "inserted run must stay bold");
      assert.equal(descendants(paragraphs[index], "w:color")[0]?.attributes?.["w:val"], "C00000");
    }
    assert.equal(firstElement(firstElement(paragraphs[2], "w:pPr"), "w:pStyle")?.attributes?.["w:val"], "Quote");
    assert(descendants(paragraphs[2], "w:i").length > 0, "intervening run must stay italic");
    assertResolved(result.parsed, "{{ph}}");
  }],
  ["preserves real image bytes and valid image relationships between replacements", async api => {
    const image = data => new api.ImageRun({ type: "png", data, transformation: { width: 1, height: 1 } });
    const result = await documentParagraphs(api, {
      children: [
        paragraph(api, "{{ph}}"),
        new api.Paragraph({ children: [new api.TextRun("ORIGINAL IMAGE "), image(PNG_ORIGINAL)] }),
        paragraph(api, "{{ph}}"),
      ],
      patches: { ph: documentPatch(api, [new api.Paragraph({ children: [new api.TextRun("PATCH IMAGE "), image(PNG_REPLACEMENT)] }), paragraph(api, "tail")]) },
    });
    assert.deepEqual(result.texts, ["PATCH IMAGE ", "tail", "ORIGINAL IMAGE ", "PATCH IMAGE ", "tail"]);
    const blips = descendants(result.parsed, "a:blip");
    assert.equal(blips.length, 3);
    const relationships = rootElement(await parsePart(result.zip, "word/_rels/document.xml.rels"), "Relationships");
    const imageRelationships = elements(relationships, "Relationship")
      .filter(rel => String(rel.attributes?.Type).endsWith("/image"))
      .map(rel => [String(rel.attributes.Id), String(rel.attributes.Target)]);
    const targetsById = new Map(imageRelationships);
    const imageTargets = blips.map(blip => targetsById.get(String(blip.attributes?.["r:embed"])));
    assert.equal(imageTargets.length, 3);
    for (const target of imageTargets) {
      assert(target, "every image drawing must resolve to a relationship target");
      assert(result.zip.file(`word/${target}`), `missing related image word/${target}`);
    }
    const mediaBytes = await Promise.all(
      Object.keys(result.zip.files).filter(name => name.startsWith("word/media/") && !result.zip.files[name].dir).map(name => result.zip.file(name).async("nodebuffer")),
    );
    assert(mediaBytes.some(bytes => bytes.equals(PNG_ORIGINAL)), "original image bytes must remain");
    assert(mediaBytes.some(bytes => bytes.equals(PNG_REPLACEMENT)), "replacement image bytes must exist");
    assertResolved(result.parsed, "{{ph}}");
  }],
  ["preserves real external hyperlink targets between replacements", async api => {
    const linkParagraph = (text, link) => new api.Paragraph({
      children: [new api.ExternalHyperlink({ children: [new api.TextRun(text)], link })],
    });
    const result = await documentParagraphs(api, {
      children: [paragraph(api, "{{ph}}"), linkParagraph("ORIGINAL LINK", "https://example.com/original"), paragraph(api, "{{ph}}")],
      patches: { ph: documentPatch(api, [linkParagraph("PATCH LINK", "https://example.com/replacement"), paragraph(api, "tail")]) },
    });
    assert.deepEqual(result.texts, ["PATCH LINK", "tail", "ORIGINAL LINK", "PATCH LINK", "tail"]);
    const hyperlinks = descendants(result.parsed, "w:hyperlink");
    assert.equal(hyperlinks.length, 3);
    const relationships = rootElement(await parsePart(result.zip, "word/_rels/document.xml.rels"), "Relationships");
    const targetsById = new Map(
      elements(relationships, "Relationship")
        .filter(rel => String(rel.attributes?.Type).endsWith("/hyperlink"))
        .map(rel => [String(rel.attributes.Id), String(rel.attributes.Target)]),
    );
    const actualTargets = hyperlinks.map(link => targetsById.get(String(link.attributes?.["r:id"])));
    assert.deepEqual(actualTargets.sort(), [
      "https://example.com/original",
      "https://example.com/replacement",
      "https://example.com/replacement",
    ].sort());
    assertResolved(result.parsed, "{{ph}}");
  }],
  ["replaces a single DOCUMENT placeholder", async api => {
    const result = await documentParagraphs(api, {
      children: [paragraph(api, "BEFORE"), paragraph(api, "{{ph}}"), paragraph(api, "AFTER")],
      patches: { ph: documentPatch(api, [paragraph(api, "X"), paragraph(api, "Y")]) },
    });
    assert.deepEqual(result.texts, ["BEFORE", "X", "Y", "AFTER"]);
    assertResolved(result.parsed, "{{ph}}");
  }],
  ["leaves a document unchanged when the DOCUMENT key has no match", async api => {
    const result = await documentParagraphs(api, {
      children: [paragraph(api, "BEFORE"), paragraph(api, "{{other}}"), paragraph(api, "AFTER")],
      patches: { ph: documentPatch(api, [paragraph(api, "X"), paragraph(api, "Y")]) },
    });
    assert.deepEqual(result.texts, ["BEFORE", "{{other}}", "AFTER"]);
    assert.equal(countText(result.texts, "X"), 0);
  }],
  ["keeps repeated PARAGRAPH replacement behavior across paragraphs", async api => {
    const result = await documentParagraphs(api, {
      children: [paragraph(api, "A {{ph}} B"), paragraph(api, "KEEP"), paragraph(api, "C {{ph}} D")],
      patches: { ph: paragraphPatch(api, [new api.TextRun({ text: "INLINE", bold: true })]) },
    });
    assert.deepEqual(result.texts, ["A INLINE B", "KEEP", "C INLINE D"]);
    assert.equal(descendants(result.parsed, "w:b").length, 2);
    assertResolved(result.parsed, "{{ph}}");
  }],
  ["keeps recursive repeated PARAGRAPH replacement behavior in one paragraph", async api => {
    const result = await documentParagraphs(api, {
      children: [paragraph(api, "A {{ph}} B {{ph}} C")],
      patches: { ph: paragraphPatch(api, [new api.TextRun("INLINE")]) },
      recursive: true,
    });
    assert.deepEqual(result.texts, ["A INLINE B INLINE C"]);
    assertResolved(result.parsed, "{{ph}}");
  }],
];

for (const [mode, api] of [["esm", esmDocx], ["cjs", cjsDocx]]) {
  for (const [name, run] of scenarios) {
    test(`[${mode}] ${name}`, () => run(api));
  }
}
